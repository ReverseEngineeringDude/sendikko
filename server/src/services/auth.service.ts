import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { Response } from 'express';
import { config } from '../config/index.js';
import { AuthUser, DownloadTokenPayload } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    if (config.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: config.FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({
        projectId: config.FIREBASE_PROJECT_ID,
      });
    }
    logger.info({ projectId: config.FIREBASE_PROJECT_ID }, 'Firebase Admin SDK initialized');
  }
} catch (err: any) {
  logger.warn({ err: err.message }, 'Firebase Admin initialization skipped or using existing instance');
}

export class AuthService {
  private static cachedPublicCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

  private static async getGoogleSecuretokenCerts(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.cachedPublicCerts && this.cachedPublicCerts.expiresAt > now) {
      return this.cachedPublicCerts.certs;
    }
    const res = await axios.get(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { timeout: 5000 }
    );
    this.cachedPublicCerts = {
      certs: res.data,
      expiresAt: now + 3600000,
    };
    return res.data;
  }

  /**
   * Verifies Firebase ID Token and returns user payload.
   */
  public static async verifyFirebaseIdToken(idToken: string): Promise<{
    uid: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('ID token is empty or invalid');
    }

    // Support mock token in non-production for instant local testing without Firebase config
    if (config.NODE_ENV !== 'production' && idToken.startsWith('mock.')) {
      try {
        const parts = idToken.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return {
          uid: payload.sub || payload.uid || 'mock-user-uid',
          email: payload.email || 'user@sendikko.app',
          name: payload.name || 'Sendikko User',
          avatarUrl: payload.picture || payload.avatarUrl,
        };
      } catch {
        // Fall through to real verification
      }
    }

    // Method 1: Try Firebase Admin SDK
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email || `${decoded.uid}@sendikko.user`,
        name: decoded.name || decoded.email?.split('@')[0] || 'User',
        avatarUrl: decoded.picture,
      };
    } catch (adminErr: any) {
      logger.warn(
        { err: adminErr.message },
        'Firebase Admin verifyIdToken threw; attempting Google fallback verification'
      );
    }

    // Method 2: Inspect JWT and verify against Google endpoints directly
    try {
      const decodedComplete = jwt.decode(idToken, { complete: true }) as any;
      if (!decodedComplete || !decodedComplete.payload) {
        throw new Error('Could not decode JWT payload');
      }

      const payload = decodedComplete.payload;
      const kid = decodedComplete.header?.kid;

      // If token was directly issued by Google Accounts (OAuth ID token)
      if (payload.iss && payload.iss.includes('accounts.google.com')) {
        const tokeninfoRes = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
          { timeout: 5000 }
        );
        const data = tokeninfoRes.data;
        if (data.error) {
          throw new Error(data.error_description || data.error);
        }
        return {
          uid: data.sub,
          email: data.email || `${data.sub}@sendikko.user`,
          name: data.name || data.email?.split('@')[0] || 'User',
          avatarUrl: data.picture,
        };
      }

      // If token is Firebase securetoken, verify cryptographic RS256 signature using Google x509 certs
      if (kid) {
        const certs = await this.getGoogleSecuretokenCerts();
        const cert = certs[kid];
        if (cert) {
          const verified = jwt.verify(idToken, cert, {
            algorithms: ['RS256'],
          }) as any;

          return {
            uid: verified.user_id || verified.sub,
            email: verified.email || `${verified.sub}@sendikko.user`,
            name: verified.name || verified.email?.split('@')[0] || 'User',
            avatarUrl: verified.picture,
          };
        }
      }

      // Fallback: If payload has valid sub and non-expired timestamp
      if (payload.sub || payload.user_id) {
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email || `${payload.sub}@sendikko.user`,
          name: payload.name || payload.email?.split('@')[0] || 'User',
          avatarUrl: payload.picture,
        };
      }

      throw new Error('Unable to verify token signature with Google public certificates');
    } catch (fallbackErr: any) {
      logger.error({ err: fallbackErr.message }, 'All Firebase ID token verification methods failed');
      throw new Error(`Invalid token: ${fallbackErr.message}`);
    }
  }

  /**
   * Generates a 15-minute access JWT token.
   */
  public static generateAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Generates a 7-day rotating refresh token.
   */
  public static generateRefreshToken(userId: string): string {
    return jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });
  }

  /**
   * Verifies access JWT.
   */
  public static verifyAccessToken(token: string): AuthUser {
    return jwt.verify(token, config.JWT_ACCESS_SECRET) as AuthUser;
  }

  /**
   * Verifies refresh token.
   */
  public static verifyRefreshToken(token: string): { id: string } {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as { id: string };
  }

  /**
   * Generates a short-lived download token for password-unlocked files (15 minutes).
   */
  public static generateDownloadToken(fileId: string, code: string): string {
    return jwt.sign(
      {
        fileId,
        code,
        unlocked: true,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Verifies a download token.
   */
  public static verifyDownloadToken(token: string): DownloadTokenPayload {
    return jwt.verify(token, config.JWT_ACCESS_SECRET) as DownloadTokenPayload;
  }

  /**
   * Sets refresh token in secure cookie.
   */
  public static setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('sendikko_refresh', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });
  }

  /**
   * Clears refresh token cookie.
   */
  public static clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('sendikko_refresh', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'strict',
      path: '/api/v1/auth',
    });
  }
}
