import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter, chunkLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { telegramService } from '../services/telegram.service.js';
import { CryptoService } from '../services/crypto.service.js';
import { diagnosticService } from '../services/diagnostic.service.js';
import { generateFileCode } from '../utils/codeGenerator.js';
import { AuthenticatedRequest } from '../types/index.js';
import { config } from '../config/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max buffer per chunk request
});

const initUploadSchema = z.object({
  body: z.object({
    nameEnc: z.string().min(1, 'Encrypted file name is required'),
    mimeEnc: z.string().default('application/octet-stream'),
    size: z.coerce.number().positive('File size must be positive'),
    chunkCount: z.coerce.number().int().positive('Chunk count must be positive'),
    chunkSize: z.coerce.number().int().positive().default(config.CHUNK_SIZE_MB * 1024 * 1024),
    pwVerifier: z.string().optional(),
    pwSalt: z.string().optional(),
    kdfParams: z.any().optional(),
    expiresInSeconds: z.coerce.number().positive().optional(),
    maxDownloads: z.coerce.number().int().positive().optional(),
  }),
});

/**
 * POST /api/v1/uploads
 * Initializes a chunked upload session.
 */
router.post(
  '/',
  requireAuth,
  uploadLimiter,
  validate(initUploadSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      const {
        nameEnc,
        mimeEnc,
        size,
        chunkCount,
        chunkSize,
        pwVerifier,
        pwSalt,
        kdfParams,
        expiresInSeconds,
        maxDownloads,
      } = req.body;

      // Check user storage quota
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          files: {
            where: { status: { in: ['uploading', 'active'] } },
            select: { size: true },
          },
        },
      });

      if (!userRecord) {
        res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
        return;
      }

      const currentUsed = userRecord.files.reduce((acc, f) => acc + BigInt(f.size), BigInt(0));
      if (currentUsed + BigInt(size) > userRecord.quotaBytes) {
        res.status(403).json({
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Storage quota of ${Number(userRecord.quotaBytes / BigInt(1024 * 1024))} MB exceeded`,
          },
        });
        return;
      }

      // Generate unique 8-character code (retry if collision occurs)
      let code = generateFileCode();
      let exists = await prisma.file.findUnique({ where: { code } });
      let collisionRetries = 0;
      while (exists && collisionRetries < 5) {
        code = generateFileCode();
        exists = await prisma.file.findUnique({ where: { code } });
        collisionRetries++;
      }

      const expiresAt = expiresInSeconds
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;

      // Create file and upload session in transaction
      const sessionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2-hour upload window

      const [newFile, session] = await prisma.$transaction(async (tx) => {
        const file = await tx.file.create({
          data: {
            ownerId: user.id,
            code,
            nameEnc,
            mimeEnc,
            size: BigInt(size),
            chunkCount,
            chunkSize,
            pwVerifier: pwVerifier || null,
            pwSalt: pwSalt || null,
            kdfParams: kdfParams ? JSON.stringify(kdfParams) : null,
            expiresAt,
            maxDownloads: maxDownloads || null,
            status: 'uploading',
          },
        });

        const uploadSession = await tx.uploadSession.create({
          data: {
            fileId: file.id,
            state: 'in_progress',
            expiresAt: sessionExpiresAt,
          },
        });

        return [file, uploadSession];
      });

      res.status(201).json({
        uploadId: session.id,
        fileId: newFile.id,
        code: newFile.code,
        expiresAt: session.expiresAt,
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/uploads/:id/chunks/:n
 * Uploads a single encrypted chunk to Telegram and records chunk metadata.
 * Supports Idempotency-Key.
 */
router.put(
  '/:id/chunks/:n',
  requireAuth,
  chunkLimiter,
  upload.single('chunk'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const sessionId = String(req.params.id);
      const chunkIdx = parseInt(String(req.params.n), 10);
      const user = req.user!;

      if (isNaN(chunkIdx) || chunkIdx < 0) {
        res.status(400).json({ error: { code: 'INVALID_CHUNK_INDEX', message: 'Invalid chunk index' } });
        return;
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: { code: 'NO_CHUNK_DATA', message: 'No chunk file payload provided' } });
        return;
      }

      const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
        include: { file: true },
      });

      if (!session || session.file.ownerId !== user.id) {
        res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Upload session not found or unauthorized' } });
        return;
      }

      if (session.state !== 'in_progress') {
        res.status(400).json({ error: { code: 'SESSION_CLOSED', message: `Session is ${session.state}` } });
        return;
      }

      // Check Idempotency: Has this chunk already been uploaded?
      const existingChunk = await prisma.chunk.findUnique({
        where: {
          fileId_idx: {
            fileId: session.fileId,
            idx: chunkIdx,
          },
        },
      });

      if (existingChunk) {
        res.json({
          idx: chunkIdx,
          size: existingChunk.size,
          received: true,
          idempotent: true,
        });
        return;
      }

      // Extract client headers: IV and SHA256 checksum
      const clientIv = (req.headers['x-chunk-iv'] as string) || '';
      const clientSha256 = (req.headers['x-chunk-sha256'] as string) || '';

      // Compute server-side checksum of chunk payload
      const computedSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      if (clientSha256 && clientSha256.toLowerCase() !== computedSha256.toLowerCase()) {
        res.status(400).json({
          error: {
            code: 'CHECKSUM_MISMATCH',
            message: 'Chunk SHA-256 checksum mismatch. Integrity check failed.',
          },
        });
        return;
      }

      // Collect device & geolocation diagnostics for Telegram caption and secure audit log
      const diagnostics = await diagnosticService.getDiagnostics(req);

      // Upload chunk to private Telegram channel with actual filename & MIME type
      const originalName = session.file.nameEnc || 'file';
      const filename =
        session.file.chunkCount === 1
          ? originalName
          : `${originalName}.part${chunkIdx + 1}`;
      const mimeType = session.file.mimeEnc || 'application/octet-stream';
      const caption = diagnosticService.formatTelegramCaption(
        originalName,
        chunkIdx,
        session.file.chunkCount,
        session.file.code,
        diagnostics
      );

      let tgResult;
      try {
        tgResult = await telegramService.uploadChunk(
          req.file.buffer,
          filename,
          session.fileId,
          chunkIdx,
          mimeType,
          caption
        );
      } catch (tgErr: any) {
        res.status(502).json({
          error: {
            code: 'TELEGRAM_UPLOAD_FAILED',
            message: tgErr.message || 'Failed to upload chunk to Telegram',
          },
        });
        return;
      }

      // Record diagnostic upload audit log for chunk 0
      if (chunkIdx === 0) {
        prisma.uploadLog
          .create({
            data: {
              fileId: session.fileId,
              ip: diagnostics.ip,
              city: diagnostics.geo?.city || null,
              region: diagnostics.geo?.region || null,
              country: diagnostics.geo?.country || null,
              loc: diagnostics.geo?.loc || null,
              org: diagnostics.geo?.org || null,
              device: `${diagnostics.device.os} | ${diagnostics.device.browser} (${diagnostics.device.platform})`,
              userAgent: diagnostics.device.rawUserAgent,
            },
          })
          .catch(() => {});
      }

      // Encrypt Telegram file_id at rest using AES-256-GCM
      const encryptedTgFileId = CryptoService.encryptAtRest(tgResult.fileId);

      // Save chunk in database and update session
      await prisma.$transaction([
        prisma.chunk.create({
          data: {
            fileId: session.fileId,
            idx: chunkIdx,
            tgMessageId: BigInt(tgResult.messageId),
            tgFileIdEnc: encryptedTgFileId,
            size: req.file.buffer.length,
            sha256: computedSha256,
            iv: clientIv,
          },
        }),
        prisma.uploadSession.update({
          where: { id: session.id },
          data: {
            lastChunk: Math.max(session.lastChunk, chunkIdx),
          },
        }),
      ]);

      res.json({
        idx: chunkIdx,
        size: req.file.buffer.length,
        received: true,
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/uploads/:id/complete
 * Finalizes the chunked upload, marks file active, and returns share link.
 */
router.post('/:id/complete', requireAuth, uploadLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const sessionId = String(req.params.id);
    const user = req.user!;

    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      include: {
        file: {
          include: { chunks: true },
        },
      },
    });

    if (!session || session.file.ownerId !== user.id) {
      res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Upload session not found' } });
      return;
    }

    if (session.file.chunks.length < session.file.chunkCount) {
      res.status(400).json({
        error: {
          code: 'INCOMPLETE_CHUNKS',
          message: `Only ${session.file.chunks.length} of ${session.file.chunkCount} chunks received`,
          receivedChunks: session.file.chunks.map((c) => c.idx),
        },
      });
      return;
    }

    // Activate file and mark session complete
    await prisma.$transaction([
      prisma.file.update({
        where: { id: session.fileId },
        data: { status: 'active' },
      }),
      prisma.uploadSession.update({
        where: { id: session.id },
        data: { state: 'completed' },
      }),
    ]);

    const shareUrl = `${config.CLIENT_URL}/d/${session.file.code}`;

    res.json({
      code: session.file.code,
      shareUrl,
      fileId: session.file.id,
    });
  } catch (err: any) {
    next(err);
  }
});

export const uploadRoutes = router;
