import { ApiService } from './api.ts';
import { clientCryptoService, ClientCryptoService } from './crypto.client.ts';
import { FileMetadata } from '../types/index.ts';

export interface DownloadCallbacks {
  onProgress: (progress: number, speed: number, eta: number) => void;
  onChunkComplete: (chunkIdx: number, totalChunks: number) => void;
  onError: (error: string) => void;
  onSuccess: () => void;
}

export class DownloadEngine {
  private metadata: FileMetadata;
  private keyHex?: string;
  private password?: string;
  private downloadToken?: string;
  private callbacks: DownloadCallbacks;
  private isCancelled = false;
  private startTime = 0;
  private downloadedBytes = 0;

  constructor(
    metadata: FileMetadata,
    options: {
      keyHex?: string;
      password?: string;
      downloadToken?: string;
    },
    callbacks: DownloadCallbacks
  ) {
    this.metadata = metadata;
    this.keyHex = options.keyHex;
    this.password = options.password;
    this.downloadToken = options.downloadToken;
    this.callbacks = callbacks;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public async start(): Promise<void> {
    const totalSize = parseInt(this.metadata.size, 10);
    const chunkCount = this.metadata.chunkCount;
    this.startTime = Date.now();

    try {
      // Decrypt filename
      let fileName = 'downloaded_file';
      if (this.keyHex) {
        fileName = await ClientCryptoService.decryptString(this.metadata.nameEnc, this.keyHex);
      } else {
        fileName = this.metadata.nameEnc;
      }

      // Check if File System Access API is supported for direct disk streaming
      let fileWritableStream: any = null;
      let hasFileSystemAccess = false;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
          });
          fileWritableStream = await handle.createWritable();
          hasFileSystemAccess = true;
        } catch (pickErr: any) {
          if (pickErr.name === 'AbortError') {
            return; // User cancelled the picker dialog
          }
          // Otherwise fallback to Blob accumulation
        }
      }

      const collectedBlobs: Blob[] = [];

      for (let idx = 0; idx < chunkCount; idx++) {
        if (this.isCancelled) {
          if (fileWritableStream) await fileWritableStream.abort();
          throw new Error('Download cancelled');
        }

        let chunkPreviousLoaded = 0;
        const res = await ApiService.downloadChunkStream(
          this.metadata.code,
          idx,
          this.downloadToken,
          (loaded) => {
            const delta = loaded - chunkPreviousLoaded;
            if (delta > 0) {
              this.downloadedBytes += delta;
              chunkPreviousLoaded = loaded;
              const elapsedSec = (Date.now() - this.startTime) / 1000;
              const speed = elapsedSec > 0 ? this.downloadedBytes / elapsedSec : 0;
              const remainingBytes = Math.max(0, totalSize - this.downloadedBytes);
              const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
              const progress = Math.min(100, Math.floor((this.downloadedBytes / totalSize) * 100));
              this.callbacks.onProgress(progress, speed, eta);
            }
          }
        );

        const headerIv =
          res.headers?.['x-chunk-iv'] ||
          res.headers?.['X-Chunk-IV'] ||
          (typeof (res.headers as any)?.get === 'function'
            ? ((res.headers as any).get('x-chunk-iv') || (res.headers as any).get('X-Chunk-IV'))
            : undefined);

        const ivHex = headerIv || this.metadata.chunks?.[idx]?.iv || '';
        const rawChunkData = res.data as ArrayBuffer;
        let chunkBytes = rawChunkData;

        // If chunk was encrypted with a non-zero IV and credentials exist, decrypt it
        if (ivHex && ivHex !== '000000000000000000000000' && (this.keyHex || this.password)) {
          chunkBytes = await clientCryptoService.decryptChunk(
            rawChunkData,
            idx,
            ivHex,
            {
              keyHex: this.keyHex,
              password: this.password,
              saltHex: this.metadata.pwSalt,
            }
          );
        }

        if (hasFileSystemAccess && fileWritableStream) {
          await fileWritableStream.write(chunkBytes);
        } else {
          collectedBlobs.push(new Blob([chunkBytes]));
        }

        this.callbacks.onChunkComplete(idx + 1, chunkCount);
      }

      if (hasFileSystemAccess && fileWritableStream) {
        await fileWritableStream.close();
      } else {
        // Fallback: save accumulated chunks via Blob and anchor download
        const finalBlob = new Blob(collectedBlobs, {
          type: this.metadata.mimeEnc || 'application/octet-stream',
        });
        const blobUrl = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }

      this.callbacks.onSuccess();
    } catch (err: any) {
      if (!this.isCancelled) {
        this.callbacks.onError(err.message || 'Download and decryption failed');
      }
    }
  }
}
