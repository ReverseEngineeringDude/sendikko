import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { unlockLimiter, reportLimiter, chunkLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { AuthService } from '../services/auth.service.js';
import { CryptoService } from '../services/crypto.service.js';
import { telegramService } from '../services/telegram.service.js';
import { generateFileCode, isValidFileCode } from '../utils/codeGenerator.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// In-memory failed password tracker: key = `${ipHash}:${code}` -> { attempts: number, lockedUntil: number }
interface FailedAttemptInfo {
  attempts: number;
  lockedUntil: number;
}
const failedAttemptsMap = new Map<string, FailedAttemptInfo>();

const checkBruteForceLock = (key: string): { locked: boolean; remainingSec: number } => {
  const record = failedAttemptsMap.get(key);
  if (!record) return { locked: false, remainingSec: 0 };
  const now = Date.now();
  if (record.lockedUntil > now) {
    return { locked: true, remainingSec: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  return { locked: false, remainingSec: 0 };
};

const registerFailedAttempt = (key: string): void => {
  const now = Date.now();
  const current = failedAttemptsMap.get(key) || { attempts: 0, lockedUntil: 0 };
  const attempts = current.attempts + 1;
  let lockedUntil = 0;
  if (attempts >= 5) {
    // Exponential cooldown: 5 fails -> 1m, 6 fails -> 2m, 7 fails -> 4m, etc.
    const cooldownMs = Math.min(3600000, Math.pow(2, attempts - 5) * 60000);
    lockedUntil = now + cooldownMs;
  }
  failedAttemptsMap.set(key, { attempts, lockedUntil });
};

const resetFailedAttempts = (key: string): void => {
  failedAttemptsMap.delete(key);
};

const unlockSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
  }),
});

const patchFileSchema = z.object({
  body: z.object({
    nameEnc: z.string().optional(),
    pwVerifier: z.string().nullable().optional(),
    pwSalt: z.string().nullable().optional(),
    kdfParams: z.any().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    maxDownloads: z.number().int().positive().nullable().optional(),
  }),
});

const reportSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'Reason must be at least 5 characters').max(1000),
  }),
});

/**
 * GET /api/v1/files/:code
 * Public endpoint: returns safe metadata.
 */
router.get('/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    if (!isValidFileCode(code)) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Invalid or unknown file code' } });
      return;
    }

    const file = await prisma.file.findUnique({
      where: { code },
      include: {
        owner: { select: { name: true } },
        chunks: {
          select: { idx: true, iv: true, sha256: true, size: true },
          orderBy: { idx: 'asc' },
        },
      },
    });

    if (!file || file.status === 'trashed') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or has been removed' } });
      return;
    }

    if (file.status === 'expired' || (file.expiresAt && file.expiresAt < new Date())) {
      res.status(410).json({ error: { code: 'FILE_EXPIRED', message: 'This file link has expired' } });
      return;
    }

    if (file.status === 'disabled') {
      res.status(403).json({ error: { code: 'FILE_DISABLED', message: 'This file has been disabled by administration' } });
      return;
    }

    if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
      res.status(410).json({ error: { code: 'DOWNLOAD_LIMIT_REACHED', message: 'This file has reached its download limit' } });
      return;
    }

    res.json({
      code: file.code,
      nameEnc: file.nameEnc,
      mimeEnc: file.mimeEnc,
      size: file.size.toString(),
      chunkCount: file.chunkCount,
      chunkSize: file.chunkSize,
      passwordRequired: !!file.pwVerifier,
      pwSalt: file.pwSalt,
      kdfParams: file.kdfParams ? JSON.parse(file.kdfParams) : null,
      expiresAt: file.expiresAt,
      maxDownloads: file.maxDownloads,
      downloadCount: file.downloadCount,
      uploaderName: file.owner.name,
      createdAt: file.createdAt,
      chunks: file.chunks,
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v1/files/:code/unlock
 * Public endpoint: verifies password for password-protected files.
 */
router.post(
  '/:code/unlock',
  unlockLimiter,
  validate(unlockSchema),
  async (req: Request, res, next) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const { password } = req.body;
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const ipHash = CryptoService.hashIp(ip);
      const lockKey = `${ipHash}:${code}`;

      // Check brute-force lockout
      const lockStatus = checkBruteForceLock(lockKey);
      if (lockStatus.locked) {
        res.status(429).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Too many wrong password attempts. Try again in ${lockStatus.remainingSec} seconds.`,
          },
        });
        return;
      }

      const file = await prisma.file.findUnique({ where: { code } });
      if (!file || file.status !== 'active') {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
        return;
      }

      if (!file.pwVerifier || !file.pwSalt) {
        // File does not need password
        const token = AuthService.generateDownloadToken(file.id, file.code);
        res.json({ downloadToken: token, expiresIn: 900 });
        return;
      }

      const isValid = CryptoService.verifyPassword(password, file.pwSalt, file.pwVerifier);

      if (!isValid) {
        registerFailedAttempt(lockKey);
        res.status(401).json({
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Incorrect password provided',
          },
        });
        return;
      }

      // Password verified successfully: reset failed counter
      resetFailedAttempts(lockKey);

      const downloadToken = AuthService.generateDownloadToken(file.id, file.code);
      res.json({
        downloadToken,
        expiresIn: 900, // 15 min
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/files/:code/chunks/:n
 * Streams an encrypted chunk directly from Telegram. Supports HTTP Range.
 */
router.get(
  '/:code/chunks/:n',
  chunkLimiter,
  optionalAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const chunkIdx = parseInt(String(req.params.n), 10);

      if (isNaN(chunkIdx) || chunkIdx < 0) {
        res.status(400).json({ error: { code: 'INVALID_CHUNK_INDEX', message: 'Invalid chunk index' } });
        return;
      }

      const file = await prisma.file.findUnique({
        where: { code },
        include: {
          chunks: { where: { idx: chunkIdx } },
        },
      });

      if (!file || file.status === 'trashed') {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
        return;
      }

      if (file.status === 'expired' || (file.expiresAt && file.expiresAt < new Date())) {
        res.status(410).json({ error: { code: 'FILE_EXPIRED', message: 'File expired' } });
        return;
      }

      // Authorization / Download Token check if password protected
      const isOwner = req.user && req.user.id === file.ownerId;
      if (file.pwVerifier && !isOwner) {
        const downloadToken = req.headers['x-download-token'] as string;
        if (!downloadToken) {
          res.status(403).json({
            error: { code: 'PASSWORD_REQUIRED', message: 'File requires password authentication' },
          });
          return;
        }

        try {
          const payload = AuthService.verifyDownloadToken(downloadToken);
          if (payload.fileId !== file.id) {
            res.status(403).json({ error: { code: 'INVALID_TOKEN', message: 'Download token invalid for this file' } });
            return;
          }
        } catch {
          res.status(403).json({ error: { code: 'EXPIRED_TOKEN', message: 'Download token expired. Please unlock again.' } });
          return;
        }
      }

      // Burn after N downloads check
      if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
        res.status(410).json({ error: { code: 'DOWNLOAD_LIMIT_REACHED', message: 'Download limit reached' } });
        return;
      }

      const chunk = file.chunks[0];
      if (!chunk) {
        res.status(404).json({ error: { code: 'CHUNK_NOT_FOUND', message: `Chunk ${chunkIdx} not found` } });
        return;
      }

      // If downloading the first chunk (idx = 0), atomically record download log and increment download_count
      if (chunkIdx === 0) {
        const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const clientUa = req.headers['user-agent'] || 'unknown';
        const ipHash = CryptoService.hashIp(clientIp);
        const uaHash = CryptoService.hashUserAgent(clientUa);

        await prisma.$transaction(async (tx) => {
          const updated = await tx.file.update({
            where: { id: file.id },
            data: { downloadCount: { increment: 1 } },
          });

          await tx.downloadLog.create({
            data: {
              fileId: file.id,
              ipHash,
              uaHash,
            },
          });

          // Check if burn-after-reading triggered
          if (updated.maxDownloads && updated.downloadCount >= updated.maxDownloads) {
            await tx.file.update({
              where: { id: file.id },
              data: { status: 'expired' },
            });
          }
        });
      }

      // Decrypt stored Telegram file_id
      const tgFileId = CryptoService.decryptAtRest(chunk.tgFileIdEnc);

      // Stream chunk from Telegram
      const range = req.headers.range;
      const { stream, headers } = await telegramService.getChunkStream(tgFileId, range);

      res.setHeader('Access-Control-Expose-Headers', 'X-Chunk-Index, X-Chunk-IV, X-Chunk-SHA256, Content-Disposition, Content-Range, Content-Length');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="chunk_${chunkIdx}.bin"`);
      res.setHeader('X-Chunk-Index', chunkIdx.toString());
      res.setHeader('X-Chunk-IV', chunk.iv);
      res.setHeader('X-Chunk-SHA256', chunk.sha256);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (headers['content-range']) {
        res.status(206);
        res.setHeader('Content-Range', headers['content-range']);
      }
      if (headers['content-length']) {
        res.setHeader('Content-Length', headers['content-length']);
      }

      stream.pipe(res);
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/files/:code/preview
 * Streams chunk 0 as inline image preview for images without incrementing download count.
 */
router.get(
  '/:code/preview',
  chunkLimiter,
  optionalAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!isValidFileCode(code)) {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Invalid file code' } });
        return;
      }

      const file = await prisma.file.findUnique({
        where: { code },
        include: {
          chunks: { where: { idx: 0 } },
        },
      });

      if (!file || file.status === 'trashed' || file.status === 'expired') {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
        return;
      }

      // Check access if password protected
      const isOwner = req.user && req.user.id === file.ownerId;
      if (file.pwVerifier && !isOwner) {
        res.status(403).json({ error: { code: 'PASSWORD_REQUIRED', message: 'File is password-protected' } });
        return;
      }

      const chunk = file.chunks[0];
      if (!chunk) {
        res.status(404).json({ error: { code: 'CHUNK_NOT_FOUND', message: 'Preview chunk not found' } });
        return;
      }

      const ext = file.nameEnc.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon',
        heic: 'image/heic',
      };
      const contentType = mimeTypes[ext] || 'image/jpeg';

      const tgFileId = CryptoService.decryptAtRest(chunk.tgFileIdEnc);
      const { stream, headers } = await telegramService.getChunkStream(tgFileId);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (headers['content-length']) {
        res.setHeader('Content-Length', headers['content-length']);
      }

      stream.pipe(res);
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/files/:code/stream
 * HEAD /api/v1/files/:code/stream
 * High-performance video streaming endpoint backed directly by Telegram chunk storage.
 * Designed for Reddit embeds, RedGIFs-style playback, and external players.
 * Supports HTTP 206 Partial Content Range seeking with near-zero backend memory usage.
 */
const handleVideoStream = async (req: Request, res: any, next: any) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    if (!isValidFileCode(code)) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Invalid file code' } });
      return;
    }

    const file = await prisma.file.findUnique({
      where: { code },
      include: {
        chunks: { orderBy: { idx: 'asc' } },
      },
    });

    if (!file || file.status === 'trashed' || file.status === 'expired') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Video not found or expired' } });
      return;
    }

    if (file.expiresAt && file.expiresAt < new Date()) {
      res.status(410).json({ error: { code: 'FILE_EXPIRED', message: 'Video has expired' } });
      return;
    }

    // Password protected files cannot be streamed without unlock token
    if (file.pwVerifier) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.query.token as string);
      let unlocked = false;

      if (token) {
        try {
          const payload = AuthService.verifyDownloadToken(token);
          if (payload.fileId === file.id && payload.unlocked) {
            unlocked = true;
          }
        } catch {
          // Token invalid or expired
        }
      }

      if (!unlocked) {
        res.status(403).json({ error: { code: 'PASSWORD_REQUIRED', message: 'File is password-protected' } });
        return;
      }
    }

    if (!file.chunks || file.chunks.length === 0) {
      res.status(404).json({ error: { code: 'NO_CHUNKS', message: 'No video media chunks available' } });
      return;
    }

    const ext = file.nameEnc.split('.').pop()?.toLowerCase() || 'mp4';
    const videoMimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
      ogv: 'video/ogg',
      ts: 'video/mp2t',
      gif: 'video/mp4',
    };
    const contentType = videoMimeMap[ext] || file.mimeEnc || 'video/mp4';
    const totalSize = Number(file.size);

    // Common streaming headers for Reddit, browsers, and embeds
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    // Fast HEAD response: Reddit and crawlers check this first to inspect video headers
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', totalSize.toString());
      res.status(200).end();
      return;
    }

    const rangeHeader = req.headers.range;

    // Single chunk file (standard for most clips and videos < 19MB)
    if (file.chunkCount === 1) {
      const chunk = file.chunks[0];
      const tgFileId = CryptoService.decryptAtRest(chunk.tgFileIdEnc);

      const { stream, headers, status } = await telegramService.getChunkStream(tgFileId, rangeHeader);

      if (headers['content-range']) {
        res.status(status === 206 ? 206 : 200);
        res.setHeader('Content-Range', headers['content-range']);
      } else if (rangeHeader) {
        res.status(206);
        res.setHeader('Content-Range', `bytes 0-${chunk.size - 1}/${totalSize}`);
      } else {
        res.status(200);
      }

      if (headers['content-length']) {
        res.setHeader('Content-Length', headers['content-length']);
      } else {
        res.setHeader('Content-Length', chunk.size.toString());
      }

      // If client aborts or scrubs, kill upstream Telegram connection immediately to save server bandwidth
      req.on('close', () => {
        stream.destroy();
      });

      stream.pipe(res);
      return;
    }

    // Multi-chunk video file (seeking across 19MB chunk boundaries)
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + file.chunkSize - 1, totalSize - 1);

      const chunkIdx = Math.floor(start / file.chunkSize);
      const chunk = file.chunks.find((c) => c.idx === chunkIdx) || file.chunks[0];
      const chunkRelStart = start % file.chunkSize;
      const chunkRelEnd = Math.min(chunk.size - 1, chunkRelStart + (end - start));

      const tgFileId = CryptoService.decryptAtRest(chunk.tgFileIdEnc);
      const { stream } = await telegramService.getChunkStream(
        tgFileId,
        `bytes=${chunkRelStart}-${chunkRelEnd}`
      );

      const actualServedBytes = chunkRelEnd - chunkRelStart + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${start + actualServedBytes - 1}/${totalSize}`);
      res.setHeader('Content-Length', actualServedBytes.toString());

      req.on('close', () => {
        stream.destroy();
      });

      stream.pipe(res);
      return;
    }

    // No Range header on multi-chunk file: Stream chunk 0 from beginning
    const chunk0 = file.chunks[0];
    const tgFileId = CryptoService.decryptAtRest(chunk0.tgFileIdEnc);
    const { stream, headers } = await telegramService.getChunkStream(tgFileId);

    res.status(200);
    res.setHeader('Content-Length', headers['content-length'] || chunk0.size.toString());

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  } catch (err: any) {
    next(err);
  }
};

router.get('/:code/stream', handleVideoStream);
router.head('/:code/stream', handleVideoStream);

/**
 * PATCH /api/v1/files/:id
 * Owner only: updates file settings (name, password, expiry, maxDownloads).
 */
router.patch(
  '/:id',
  requireAuth,
  validate(patchFileSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const fileId = String(req.params.id);
      const user = req.user!;

      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (!file || file.ownerId !== user.id) {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or unauthorized' } });
        return;
      }

      const { nameEnc, pwVerifier, pwSalt, kdfParams, expiresAt, maxDownloads } = req.body;

      const updated = await prisma.file.update({
        where: { id: fileId },
        data: {
          nameEnc: nameEnc !== undefined ? nameEnc : file.nameEnc,
          pwVerifier: pwVerifier !== undefined ? pwVerifier : file.pwVerifier,
          pwSalt: pwSalt !== undefined ? pwSalt : file.pwSalt,
          kdfParams: kdfParams !== undefined ? (kdfParams ? JSON.stringify(kdfParams) : null) : file.kdfParams,
          expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : file.expiresAt,
          maxDownloads: maxDownloads !== undefined ? maxDownloads : file.maxDownloads,
        },
      });

      res.json({
        id: updated.id,
        code: updated.code,
        nameEnc: updated.nameEnc,
        passwordRequired: !!updated.pwVerifier,
        expiresAt: updated.expiresAt,
        maxDownloads: updated.maxDownloads,
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/files/:id/regenerate-code
 * Owner only: invalidates old code and assigns a new unique 8-character code.
 */
router.post('/:id/regenerate-code', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const fileId = String(req.params.id);
    const user = req.user!;

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== user.id) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or unauthorized' } });
      return;
    }

    let newCode = generateFileCode();
    let collisionCheck = await prisma.file.findUnique({ where: { code: newCode } });
    let attempts = 0;
    while (collisionCheck && attempts < 5) {
      newCode = generateFileCode();
      collisionCheck = await prisma.file.findUnique({ where: { code: newCode } });
      attempts++;
    }

    const updated = await prisma.file.update({
      where: { id: fileId },
      data: { code: newCode },
    });

    res.json({
      id: updated.id,
      code: updated.code,
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * DELETE /api/v1/files/:id
 * Owner only: soft-deletes file to trash (7-day retention).
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const fileId = String(req.params.id);
    const user = req.user!;

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== user.id) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or unauthorized' } });
      return;
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'trashed',
        deletedAt: new Date(),
      },
    });

    res.json({ message: 'File moved to trash' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v1/files/:id/restore
 * Owner only: restores file from trash.
 */
router.post('/:id/restore', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const fileId = String(req.params.id);
    const user = req.user!;

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== user.id) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or unauthorized' } });
      return;
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'active',
        deletedAt: null,
      },
    });

    res.json({ message: 'File restored successfully' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * DELETE /api/v1/files/:id/permanent
 * Owner only: permanently deletes file from database and purges chunks from Telegram channel.
 */
router.delete('/:id/permanent', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const fileId = String(req.params.id);
    const user = req.user!;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { chunks: true },
    });

    if (!file || file.ownerId !== user.id) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or unauthorized' } });
      return;
    }

    // Delete all chunks on Telegram
    for (const chunk of file.chunks) {
      await telegramService.deleteChunkMessage(chunk.tgMessageId);
    }

    // Cascade delete file in DB
    await prisma.file.delete({ where: { id: fileId } });

    res.json({ message: 'File permanently deleted from storage and database' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v1/files/:code/report
 * Public endpoint: report abuse or malicious file.
 */
router.post(
  '/:code/report',
  reportLimiter,
  validate(reportSchema),
  async (req, res, next) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const { reason } = req.body;

      const file = await prisma.file.findUnique({ where: { code } });
      if (!file) {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
        return;
      }

      await prisma.report.create({
        data: {
          fileId: file.id,
          reason,
        },
      });

      res.status(201).json({ message: 'Report submitted. Thank you for keeping Sendikko safe.' });
    } catch (err: any) {
      next(err);
    }
  }
);

export const fileRoutes = router;
