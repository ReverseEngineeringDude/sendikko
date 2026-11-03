import CryptoWorker from '../workers/crypto.worker.ts?worker';

export interface CryptoOptions {
  keyHex?: string;
  password?: string;
  saltHex?: string;
}

export class ClientCryptoService {
  private worker: Worker;
  private pendingRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();

  constructor() {
    this.worker = new CryptoWorker();
    this.worker.onmessage = (e: MessageEvent) => {
      const { id, success, error, ...rest } = e.data;
      const promise = this.pendingRequests.get(id);
      if (!promise) return;

      this.pendingRequests.delete(id);
      if (success) {
        promise.resolve(rest);
      } else {
        promise.reject(new Error(error || 'Crypto operation failed'));
      }
    };
  }

  private sendWorkerMessage<T>(type: string, payload: any, transfer: Transferable[] = []): Promise<T> {
    const id = Math.random().toString(36).substring(2, 11);
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload }, transfer);
    });
  }

  /**
   * Generates a 256-bit cryptographically secure random key in hex format.
   */
  public static generateRandomKeyHex(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a random 16-byte salt in hex format.
   */
  public static generateSaltHex(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derives a server password verifier for authentication without revealing the encryption key.
   */
  public async deriveServerVerifier(password: string, saltHex: string): Promise<string> {
    const res = await this.sendWorkerMessage<{ verifierHex: string }>('DERIVE_SERVER_VERIFIER', {
      password,
      saltHex,
    });
    return res.verifierHex;
  }

  /**
   * Encrypts a single chunk using AES-256-GCM.
   */
  public async encryptChunk(
    chunkData: ArrayBuffer,
    chunkIdx: number,
    options: CryptoOptions
  ): Promise<{ encryptedData: ArrayBuffer; ivHex: string; sha256Hex: string }> {
    return this.sendWorkerMessage(
      'ENCRYPT_CHUNK',
      {
        chunkData,
        chunkIdx,
        keyHex: options.keyHex,
        password: options.password,
        saltHex: options.saltHex,
      },
      [chunkData]
    );
  }

  /**
   * Decrypts a single chunk using AES-256-GCM.
   */
  public async decryptChunk(
    encryptedData: ArrayBuffer,
    chunkIdx: number,
    ivHex: string,
    options: CryptoOptions
  ): Promise<ArrayBuffer> {
    const res = await this.sendWorkerMessage<{ decryptedData: ArrayBuffer }>(
      'DECRYPT_CHUNK',
      {
        encryptedData,
        chunkIdx,
        ivHex,
        keyHex: options.keyHex,
        password: options.password,
        saltHex: options.saltHex,
      },
      [encryptedData]
    );
    return res.decryptedData;
  }

  /**
   * Encrypts a string (e.g. filename) with AES-256-GCM directly in browser Web Crypto.
   */
  public static async encryptString(plainText: string, keyHex: string): Promise<string> {
    const enc = new TextEncoder();
    const keyBytes = new Uint8Array(keyHex.length / 2);
    for (let i = 0; i < keyHex.length; i += 2) {
      keyBytes[i / 2] = parseInt(keyHex.substring(i, i + 2), 16);
    }

    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
      'encrypt',
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plainText)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // base64 url-safe
    return btoa(String.fromCharCode(...combined))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Decrypts a string encrypted with encryptString.
   */
  public static async decryptString(cipherTextBase64: string, keyHex: string): Promise<string> {
    try {
      const base64 = cipherTextBase64.replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const combined = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        combined[i] = raw.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const keyBytes = new Uint8Array(keyHex.length / 2);
      for (let i = 0; i < keyHex.length; i += 2) {
        keyBytes[i / 2] = parseInt(keyHex.substring(i, i + 2), 16);
      }

      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
        'decrypt',
      ]);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      return cipherTextBase64; // fallback if plain
    }
  }

  public terminate(): void {
    this.worker.terminate();
  }
}

export const clientCryptoService = new ClientCryptoService();
