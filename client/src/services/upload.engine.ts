import { ApiService } from './api.ts';
import { clientCryptoService, ClientCryptoService } from './crypto.client.ts';
import { FileItem } from '../types/index.ts';

const CHUNK_SIZE = 19 * 1024 * 1024; // 19 MB
const CONCURRENCY_LIMIT = 3; // 3 parallel chunk uploads

export interface UploadCallbacks {
  onProgress: (progress: number, speed: number, eta: number) => void;
  onChunkComplete: (chunkIdx: number, totalChunks: number) => void;
  onError: (error: string) => void;
  onSuccess: (result: { code: string; shareUrl: string; keyHex?: string }) => void;
}

export class UploadEngine {
  private fileItem: FileItem;
  private callbacks: UploadCallbacks;
  private isPaused = false;
  private isCancelled = false;
  private activeUploadsCount = 0;
  private startTime = 0;
  private uploadedBytes = 0;

  constructor(fileItem: FileItem, callbacks: UploadCallbacks) {
    this.fileItem = fileItem;
    this.callbacks = callbacks;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async start(): Promise<void> {
    const file = this.fileItem.file;
    const totalSize = file.size;
    const chunkCount = Math.ceil(totalSize / CHUNK_SIZE);
    this.startTime = Date.now();

    try {
      let pwSalt: string | undefined;
      let pwVerifier: string | undefined;

      if (this.fileItem.options.password) {
        pwSalt = ClientCryptoService.generateSaltHex();
        pwVerifier = await clientCryptoService.deriveServerVerifier(
          this.fileItem.options.password,
          pwSalt
        );
      }

      // Store original filename so cloud storage renders real images/documents
      const nameEnc = file.name;

      // Initialize upload session on server
      const initRes = await ApiService.initUpload({
        nameEnc,
        mimeEnc: file.type || 'application/octet-stream',
        size: totalSize,
        chunkCount,
        chunkSize: CHUNK_SIZE,
        pwVerifier,
        pwSalt,
        kdfParams: pwSalt
          ? { algorithm: 'PBKDF2', iterations: 600000, hash: 'SHA-256' }
          : undefined,
        expiresInSeconds: this.fileItem.options.expiresInSeconds,
        maxDownloads: this.fileItem.options.maxDownloads,
      });

      const { uploadId, code } = initRes.data;

      // Prepare chunk queue
      const chunkQueue: number[] = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkQueue.push(i);
      }

      const completedChunks = new Set<number>();

      // Worker loop for concurrent chunk uploads (max 3 in parallel)
      const uploadWorker = async (): Promise<void> => {
        while (chunkQueue.length > 0) {
          if (this.isCancelled) throw new Error('Upload cancelled by user');

          while (this.isPaused) {
            await this.sleep(300);
            if (this.isCancelled) throw new Error('Upload cancelled by user');
          }

          const chunkIdx = chunkQueue.shift();
          if (chunkIdx === undefined) break;

          this.activeUploadsCount++;
          try {
            await this.processAndUploadChunk(file, chunkIdx, uploadId);

            completedChunks.add(chunkIdx);
            this.callbacks.onChunkComplete(completedChunks.size, chunkCount);

            // Compute speed and ETA
            const elapsedSec = (Date.now() - this.startTime) / 1000;
            const speed = elapsedSec > 0 ? this.uploadedBytes / elapsedSec : 0;
            const remainingBytes = Math.max(0, totalSize - this.uploadedBytes);
            const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
            const progress = Math.min(100, Math.floor((this.uploadedBytes / totalSize) * 100));

            this.callbacks.onProgress(progress, speed, eta);
          } finally {
            this.activeUploadsCount--;
          }
        }
      };

      // Run parallel workers
      const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, chunkCount) },
        () => uploadWorker()
      );
      await Promise.all(workers);

      // Finalize upload
      const completeRes = await ApiService.completeUpload(uploadId);
      const fileCode = completeRes.data.code || code;
      const finalShareUrl = `${window.location.origin}/d/${fileCode}`;

      this.callbacks.onSuccess({
        code: fileCode,
        shareUrl: finalShareUrl,
      });
    } catch (err: any) {
      if (!this.isCancelled) {
        this.callbacks.onError(err.message || 'Chunk upload failed');
      }
    }
  }

  private async processAndUploadChunk(
    file: File,
    chunkIdx: number,
    uploadId: string
  ): Promise<void> {
    const startByte = chunkIdx * CHUNK_SIZE;
    const endByte = Math.min(file.size, startByte + CHUNK_SIZE);

    // Read chunk via Blob.slice without buffering entire file in memory
    const blobSlice = file.slice(startByte, endByte);
    const chunkBuffer = await blobSlice.arrayBuffer();

    // Compute SHA-256 of raw chunk bytes
    const shaBuffer = await crypto.subtle.digest('SHA-256', chunkBuffer);
    const sha256Hex = [...new Uint8Array(shaBuffer)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');

    const rawBlob = new Blob([chunkBuffer], {
      type: file.type || 'application/octet-stream',
    });

    const formData = new FormData();
    formData.append('chunk', rawBlob, file.name);

    // Retry loop with exponential backoff & jitter
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      let attemptLoaded = 0;
      try {
        const idempotencyKey = `${uploadId}-${chunkIdx}-${sha256Hex.substring(0, 16)}`;

        await ApiService.uploadChunk(
          uploadId,
          chunkIdx,
          formData,
          {
            'Idempotency-Key': idempotencyKey,
            'X-Chunk-IV': '000000000000000000000000',
            'X-Chunk-SHA256': sha256Hex,
            'X-Chunk-Size': chunkBuffer.byteLength.toString(),
          },
          (progressEvent) => {
            const loaded = progressEvent.loaded || 0;
            const delta = loaded - attemptLoaded;
            if (delta > 0) {
              this.uploadedBytes += delta;
              attemptLoaded = loaded;
            }
          }
        );

        return; // Success!
      } catch (err: any) {
        // Rollback any bytes added by this failed attempt
        if (attemptLoaded > 0) {
          this.uploadedBytes = Math.max(0, this.uploadedBytes - attemptLoaded);
        }
        const status = err.response?.status;
        const retryAfter = err.response?.data?.parameters?.retry_after;

        if (status === 429 && retryAfter) {
          await this.sleep(retryAfter * 1000 + 500);
          continue;
        }

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await this.sleep(backoff);
          continue;
        }

        throw new Error(
          err.response?.data?.error?.message ||
            `Failed to upload chunk ${chunkIdx} after ${maxRetries} attempts`
        );
      }
    }
  }
}
