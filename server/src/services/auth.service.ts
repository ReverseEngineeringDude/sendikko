import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';
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
  /**
   * Verifies Firebase ID Token and returns user payload.
   */
  public static async verifyFirebaseIdToken(idToken: string): Promise<{
    uid: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }> {
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

    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@sendikko.user`,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      avatarUrl: decoded.picture,
    };
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
