import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { CryptoService } from '../services/crypto.service.js';

const keyGenerator = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return CryptoService.hashIp(ip);
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Upload request quota exceeded. Please slow down.',
    },
  },
});

export const chunkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // high limit for chunk uploads/downloads
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many chunk requests. Please wait a moment.',
    },
  },
});

// Password unlock rate limiter per IP + file code
export const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const code = req.params.code || '';
    return `${CryptoService.hashIp(ip)}:${code}`;
  },
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many unlock attempts for this file. Please try again later.',
    },
  },
});

export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many reports submitted. Please wait before reporting again.',
    },
  },
});
