import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { TelegramApiResponse, TelegramMessage, TelegramFile } from '../types/index.js';

export interface TelegramUploadResult {
  messageId: number;
  fileId: string;
}

export class TelegramService {
  private client: AxiosInstance;
  private apiRoot: string;
  private botToken: string;
  private channelId: string;
  private mockDir: string;

  constructor() {
    this.botToken = config.TELEGRAM_BOT_TOKEN;
    this.channelId = config.TELEGRAM_CHANNEL_ID;
    this.apiRoot = config.TELEGRAM_API_ROOT.replace(/\/+$/, '');
    this.mockDir = path.join(os.tmpdir(), 'sendikko_mock_chunks');

    if (!fs.existsSync(this.mockDir)) {
      try {
        fs.mkdirSync(this.mockDir, { recursive: true });
      } catch {
        // Ignored
      }
    }

    this.client = axios.create({
      baseURL: `${this.apiRoot}/bot${this.botToken}`,
      timeout: 120000, // 2 minutes for chunk operations
    });
  }

  private isMock(): boolean {
    return (
      !this.botToken ||
      this.botToken === 'mock_bot_token' ||
      this.botToken.startsWith('mock_')
    );
  }

  /**
   * Helper: sleeps for given milliseconds with optional random jitter.
   */
  private async sleep(ms: number, jitterPercent = 0.2): Promise<void> {
    const jitter = ms * jitterPercent * (Math.random() * 2 - 1);
    const delay = Math.max(100, Math.floor(ms + jitter));
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Uploads an encrypted file chunk to the private Telegram channel as a document.
   * Handles Telegram 429 rate limits (retry_after) and retries with exponential backoff.
   */
  public async uploadChunk(
    chunkBuffer: Buffer,
    filename: string,
    fileId: string,
    chunkIdx: number,
    contentType: string = 'application/octet-stream',
    caption?: string
  ): Promise<TelegramUploadResult> {
    // If running in development without live Telegram bot token yet, use mock file storage
    if (this.isMock()) {
      logger.info(
        { fileId, chunkIdx },
        'TELEGRAM_BOT_TOKEN is set to mock. Storing chunk in local mock cache.'
      );
      const mockFilePath = path.join(this.mockDir, `${fileId}_${chunkIdx}.bin`);
      await fs.promises.writeFile(mockFilePath, chunkBuffer);
      return {
        messageId: Math.floor(Math.random() * 1000000) + 1,
        fileId: `mock_${fileId}_${chunkIdx}`,
      };
    }

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const form = new FormData();
        form.append('chat_id', this.channelId);
        form.append('caption', caption || `📁 Sendikko: ${filename}`);
        form.append('document', chunkBuffer, {
          filename,
          contentType: contentType || 'application/octet-stream',
        });

        const response = await this.client.post<TelegramApiResponse<TelegramMessage>>(
          '/sendDocument',
          form,
          {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );

        if (!response.data.ok || !response.data.result || !response.data.result.document) {
          throw new Error(
            response.data.description || 'Failed to upload document to Telegram'
          );
        }

        const msg = response.data.result;
        return {
          messageId: msg.message_id,
          fileId: msg.document!.file_id,
        };
      } catch (err: any) {
        const status = err.response?.status;
        const retryAfter = err.response?.data?.parameters?.retry_after;

        if (status === 429 && retryAfter) {
          logger.warn(
            { attempt, retryAfter, fileId, chunkIdx },
            'Telegram 429 Too Many Requests received, waiting retry_after'
          );
          await this.sleep(retryAfter * 1000 + 500);
          continue;
        }

        const isNetworkOr5xx =
          !status || (status >= 500 && status < 600) || err.code === 'ECONNABORTED';

        if (isNetworkOr5xx && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          logger.warn(
            { attempt, backoff, err: err.message, fileId, chunkIdx },
            'Telegram upload network/5xx error, retrying with backoff'
          );
          await this.sleep(backoff);
          continue;
        }

        logger.error(
          { err: err.message, response: err.response?.data, fileId, chunkIdx },
          'Fatal error uploading chunk to Telegram'
        );
        const description =
          err.response?.data?.description || err.message || 'Telegram upload failed';
        throw new Error(
          `Telegram upload failed: ${description}. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.`
        );
      }
    }

    throw new Error(`Max retries reached while uploading chunk ${chunkIdx} to Telegram`);
  }

  /**
   * Resolves the Telegram download file URL for a given file_id.
   */
  public async getFileDownloadUrl(fileId: string): Promise<string> {
    try {
      const response = await this.client.get<TelegramApiResponse<TelegramFile>>('/getFile', {
        params: { file_id: fileId },
      });

      if (!response.data.ok || !response.data.result?.file_path) {
        throw new Error(response.data.description || 'Could not resolve file path');
      }

      const filePath = response.data.result.file_path;
      return `${this.apiRoot}/file/bot${this.botToken}/${filePath}`;
    } catch (err: any) {
      logger.error({ fileId, err: err.message }, 'Failed to get file path from Telegram');
      throw new Error(err.response?.data?.description || 'Failed to retrieve chunk from Telegram');
    }
  }

  /**
   * Fetches a chunk stream directly from Telegram servers or mock cache.
   * Supports Range header for HTTP range requests.
   */
  public async getChunkStream(
    fileId: string,
    rangeHeader?: string
  ): Promise<{ stream: Readable; headers: Record<string, string> }> {
    if (fileId.startsWith('mock_')) {
      const filename = `${fileId.replace('mock_', '')}.bin`;
      const filePath = path.join(this.mockDir, filename);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Mock chunk file ${fileId} not found in local cache`);
      }

      const stats = fs.statSync(filePath);
      const stream = fs.createReadStream(filePath);
      return {
        stream,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': stats.size.toString(),
          'accept-ranges': 'bytes',
        },
      };
    }

    const downloadUrl = await this.getFileDownloadUrl(fileId);

    const headers: Record<string, string> = {};
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await axios.get<Readable>(downloadUrl, {
      responseType: 'stream',
      headers,
      timeout: 120000,
    });

    const responseHeaders: Record<string, string> = {
      'content-type': String(response.headers['content-type'] || 'application/octet-stream'),
      'content-length': String(response.headers['content-length'] || ''),
      'accept-ranges': 'bytes',
    };

    if (response.headers['content-range']) {
      responseHeaders['content-range'] = String(response.headers['content-range']);
    }

    return {
      stream: response.data,
      headers: responseHeaders,
    };
  }

  /**
   * Deletes a message containing a chunk from the Telegram channel.
   */
  public async deleteChunkMessage(messageId: number | bigint): Promise<boolean> {
    if (this.isMock()) {
      return true;
    }

    try {
      const response = await this.client.post<TelegramApiResponse<boolean>>('/deleteMessage', {
        chat_id: this.channelId,
        message_id: Number(messageId),
      });
      return response.data.ok === true;
    } catch (err: any) {
      logger.warn(
        { messageId: Number(messageId), err: err.message },
        'Failed to delete message from Telegram channel'
      );
      return false;
    }
  }

  /**
   * Health check: verifies that the bot token is valid and can access Telegram API.
   */
  public async testConnection(): Promise<{ ok: boolean; botUsername?: string; isMock?: boolean }> {
    if (this.isMock()) {
      return { ok: true, botUsername: 'mock_sendikko_bot (local dev)', isMock: true };
    }
    try {
      const res = await this.client.get<TelegramApiResponse<{ username: string }>>('/getMe');
      if (res.data.ok && res.data.result) {
        return { ok: true, botUsername: res.data.result.username, isMock: false };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }
}

export const telegramService = new TelegramService();
