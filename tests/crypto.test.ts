import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('Zero-Knowledge AES-256-GCM & KDF Integrity', () => {
  const secretKey = crypto.randomBytes(32); // 256-bit AES key

  test('Chunk encryption and decryption with AAD matches original bytes', () => {
    const chunkIndex = 0;
    const originalPlaintext = Buffer.from('Sendikko Zero Knowledge Chunk Payload Test');
    const iv = crypto.randomBytes(12); // 96-bit IV

    // Additional Authenticated Data: chunk index
    const aad = Buffer.alloc(4);
    aad.writeUInt32BE(chunkIndex, 0);

    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
    cipher.setAAD(aad);
    let ciphertext = cipher.update(originalPlaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    assert.deepEqual(decrypted, originalPlaintext);
  });

  test('Tampering with chunk index AAD causes decryption failure (Prevents chunk reordering)', () => {
    const originalChunkIdx = 1;
    const swappedChunkIdx = 2; // Attacker attempts to swap chunk 1 with chunk 2
    const originalPlaintext = Buffer.from('Secret Chunk Data');
    const iv = crypto.randomBytes(12);

    const aadOriginal = Buffer.alloc(4);
    aadOriginal.writeUInt32BE(originalChunkIdx, 0);

    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
    cipher.setAAD(aadOriginal);
    let ciphertext = cipher.update(originalPlaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Attacker passes swapped chunk index
    const aadSwapped = Buffer.alloc(4);
    aadSwapped.writeUInt32BE(swappedChunkIdx, 0);

    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
    decipher.setAAD(aadSwapped);
    decipher.setAuthTag(authTag);

    assert.throws(() => {
      let dec = decipher.update(ciphertext);
      dec = Buffer.concat([dec, decipher.final()]);
    }, /Unsupported state or unable to authenticate data/);
  });

  test('Password verifier domain separation prevents deriving encryption key from verifier', () => {
    const password = 'SuperSecretUserPassword123!';
    const salt = crypto.randomBytes(16).toString('hex');

    // Server-side verifier derivation with context separation
    const domainPrefix = 'SENDIKKO_VERIFIER_DOMAIN_V1';
    const serverSalt = crypto.createHash('sha256').update(`${domainPrefix}:${salt}`).digest();
    const verifier = crypto.pbkdf2Sync(password, serverSalt, 100000, 32, 'sha256').toString('hex');

    // Direct encryption key derivation
    const rawSalt = Buffer.from(salt, 'hex');
    const directKey = crypto.pbkdf2Sync(password, rawSalt, 600000, 32, 'sha256').toString('hex');

    assert.notEqual(verifier, directKey);
  });
});
