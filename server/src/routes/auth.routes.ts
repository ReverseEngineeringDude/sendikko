import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthService } from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const tokenAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'idToken is required'),
  }),
});

/**
 * Common handler for Firebase Auth token exchange
 */
const handleTokenExchange = async (idToken: string, res: any, next: any) => {
  let firebaseUser;
  try {
    firebaseUser = await AuthService.verifyFirebaseIdToken(idToken);
  } catch (authErr: any) {
    logger.error({ err: authErr.message }, 'Firebase token verification failed');
    res.status(401).json({
      error: {
        code: 'FIREBASE_AUTH_FAILED',
        message: authErr.message || 'Firebase authentication failed',
      },
    });
    return;
  }

  try {
    // Upsert user in Supabase / PostgreSQL database
    const user = await prisma.user.upsert({
      where: { firebaseUid: firebaseUser.uid },
      update: {
        email: firebaseUser.email,
        name: firebaseUser.name,
        avatarUrl: firebaseUser.avatarUrl,
      },
      create: {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name,
        avatarUrl: firebaseUser.avatarUrl,
      },
    });

    const accessToken = AuthService.generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const refreshToken = AuthService.generateRefreshToken(user.id);
    AuthService.setRefreshTokenCookie(res, refreshToken);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        quotaBytes: user.quotaBytes.toString(),
      },
      accessToken,
    });
  } catch (dbErr: any) {
    logger.error({ err: dbErr.message }, 'Failed to upsert user in database');
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: dbErr.message || 'Database error during authentication',
      },
    });
  }
};

/**
 * POST /api/v1/auth/firebase
 * Exchanges a Firebase ID Token for a Sendikko session.
 */
router.post('/firebase', authLimiter, validate(tokenAuthSchema), async (req, res, next) => {
  await handleTokenExchange(req.body.idToken, res, next);
});

/**
 * POST /api/v1/auth/google
 * Backward-compatible alias for frontend clients.
 */
router.post('/google', authLimiter, validate(tokenAuthSchema), async (req, res, next) => {
  await handleTokenExchange(req.body.idToken, res, next);
});

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and returns a fresh access token.
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.sendikko_refresh;
    if (!refreshToken) {
      res.status(401).json({
        error: {
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Refresh token cookie is missing',
        },
      });
      return;
    }

    const payload = AuthService.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      AuthService.clearRefreshTokenCookie(res);
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with refresh token no longer exists',
        },
      });
      return;
    }

    // Rotate refresh token
    const newRefreshToken = AuthService.generateRefreshToken(user.id);
    AuthService.setRefreshTokenCookie(res, newRefreshToken);

    const accessToken = AuthService.generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        quotaBytes: user.quotaBytes.toString(),
      },
    });
  } catch (err: any) {
    AuthService.clearRefreshTokenCookie(res);
    next({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is expired or invalid',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Clears the refresh token cookie.
 */
router.post('/logout', requireAuth, (_req: AuthenticatedRequest, res) => {
  AuthService.clearRefreshTokenCookie(res);
  res.json({ message: 'Successfully logged out' });
});

export const authRoutes = router;
