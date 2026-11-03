// Web Worker for Client-Side Cryptography (AES-256-GCM + PBKDF2 + SHA-256)

// Convert ArrayBuffer to Hex String
function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to Uint8Array
function hex2buf(hex: string): Uint8Array {
  if (!hex || typeof hex !== 'string') {
    return new Uint8Array(0);
  }
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Derives a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2 (600,000 iterations)
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 600000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Imports a raw 256-bit hex key into an AES-GCM CryptoKey
async function importRawKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hex2buf(keyHex);
  return crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// Message handler for the Web Worker
self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'DERIVE_SERVER_VERIFIER': {
        const { password, saltHex } = payload;
        const enc = new TextEncoder();

        // Server verifier uses different context: SENDIKKO_VERIFIER_DOMAIN_V1
        const combinedSalt = await crypto.subtle.digest(
          'SHA-256',
          enc.encode(`SENDIKKO_VERIFIER_DOMAIN_V1:${saltHex}`)
        );

        const passwordKey = await crypto.subtle.importKey(
          'raw',
          enc.encode(password),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );

        const verifierBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: combinedSalt as any,
            iterations: 100000,
            hash: 'SHA-256',
          },
          passwordKey,
          256
        );

        self.postMessage({ id, success: true, verifierHex: buf2hex(verifierBits) });
        break;
      }

      case 'ENCRYPT_CHUNK': {
        const { chunkData, chunkIdx, keyHex, password, saltHex } = payload;
        let cryptoKey: CryptoKey;

        if (password && saltHex) {
          cryptoKey = await deriveKeyFromPassword(password, hex2buf(saltHex));
        } else {
          cryptoKey = await importRawKey(keyHex);
        }

        // Random 96-bit (12 byte) IV per chunk
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Additional Authenticated Data: chunk index (prevents reordering/substitution)
        const aad = new Uint8Array(4);
        new DataView(aad.buffer).setUint32(0, chunkIdx, false);

        const encryptedBuffer = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv as any,
            additionalData: aad as any,
          },
          cryptoKey,
          chunkData
        );

        // Compute SHA-256 of encrypted chunk
        const shaBuffer = await crypto.subtle.digest('SHA-256', encryptedBuffer);

        self.postMessage(
          {
            id,
            success: true,
            encryptedData: encryptedBuffer,
            ivHex: buf2hex(iv.buffer),
            sha256Hex: buf2hex(shaBuffer),
          },
          [encryptedBuffer] // Transfer buffer ownership for zero-copy performance
        );
        break;
      }

      case 'DECRYPT_CHUNK': {
        const { encryptedData, chunkIdx, ivHex, keyHex, password, saltHex } = payload;
        let cryptoKey: CryptoKey;

        if (password && saltHex) {
          cryptoKey = await deriveKeyFromPassword(password, hex2buf(saltHex));
        } else if (keyHex) {
          cryptoKey = await importRawKey(keyHex);
        } else {
          throw new Error('Decryption key missing. Ensure the full share link with "#k=..." is used.');
        }

        if (!ivHex) {
          throw new Error(`Missing IV for chunk #${chunkIdx}`);
        }

        const iv = hex2buf(ivHex);
        const aad = new Uint8Array(4);
        new DataView(aad.buffer).setUint32(0, chunkIdx, false);

        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv as any,
            additionalData: aad as any,
          },
          cryptoKey,
          encryptedData
        );

        self.postMessage(
          {
            id,
            success: true,
            decryptedData: decryptedBuffer,
          },
          [decryptedBuffer]
        );
        break;
      }

      case 'COMPUTE_SHA256': {
        const { data } = payload;
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        self.postMessage({ id, success: true, hashHex: buf2hex(hashBuffer) });
        break;
      }

      default:
        self.postMessage({ id, success: false, error: `Unknown message type: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err.message || 'Crypto worker operation failed',
    });
  }
};
export {};
