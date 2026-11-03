import crypto from 'crypto';
import { config } from '../config/index.js';

export class CryptoService {
  private static chunkKeyBuffer: Buffer = Buffer.from(config.CHUNK_ENC_KEY, 'hex');

  /**
   * Encrypts a sensitive string (e.g. Telegram tg_file_id) using AES-256-GCM
   * format: iv:tag:ciphertext (hex encoded)
   */
  public static encryptAtRest(plainText: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV
    const cipher = crypto.createCipheriv('aes-256-gcm', this.chunkKeyBuffer, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an AES-256-GCM string encrypted at rest.
   */
  public static decryptAtRest(encryptedString: string): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.chunkKeyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Computes a salted SHA-256 hash of an IP address for privacy-preserving logs.
   */
  public static hashIp(ip: string): string {
    return crypto
      .createHmac('sha256', config.IP_SALT)
      .update(ip || '0.0.0.0')
      .digest('hex');
  }

  /**
   * Computes a salted SHA-256 hash of User-Agent string.
   */
  public static hashUserAgent(ua: string): string {
    return crypto
      .createHmac('sha256', config.IP_SALT)
      .update(ua || 'unknown')
      .digest('hex');
  }

  /**
   * Derives a server-side password verifier using PBKDF2 with context separation:
   * salt is combined with domain prefix "SENDIKKO_VERIFIER_SALT_V1".
   */
  public static deriveServerVerifier(password: string, salt: string): string {
    const combinedSalt = crypto
      .createHash('sha256')
      .update(`SENDIKKO_VERIFIER_DOMAIN_V1:${salt}`)
      .digest();

    return crypto
      .pbkdf2Sync(password, combinedSalt, 100000, 32, 'sha256')
      .toString('hex');
  }

  /**
   * Timing-safe verification of the password against the stored verifier.
   */
  public static verifyPassword(password: string, salt: string, storedVerifier: string): boolean {
    const derived = this.deriveServerVerifier(password, salt);
    const derivedBuf = Buffer.from(derived, 'hex');
    const storedBuf = Buffer.from(storedVerifier, 'hex');

    if (derivedBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedBuf, storedBuf);
  }

  /**
   * Generates a cryptographically secure random salt string.
   */
  public static generateSalt(length = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
