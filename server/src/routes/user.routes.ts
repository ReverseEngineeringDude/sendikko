import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/v1/me
 * Returns authenticated user profile and quota usage.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
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

    const usedBytes = userRecord.files.reduce((acc, f) => acc + BigInt(f.size), BigInt(0));

    res.json({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      avatarUrl: userRecord.avatarUrl,
      quotaBytes: userRecord.quotaBytes.toString(),
      usedBytes: usedBytes.toString(),
      role: userRecord.role,
      createdAt: userRecord.createdAt,
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v1/me/files
 * Lists the authenticated user's files with search, status filter, and pagination.
 */
router.get('/files', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    const status = (req.query.status as string) || 'active'; // 'active', 'trashed', 'expired', 'all'
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      ownerId: user.id,
    };

    if (status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { code: { contains: search.toUpperCase() } },
        { nameEnc: { contains: search } },
      ];
    }

    const [files, totalCount] = await Promise.all([
      prisma.file.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          nameEnc: true,
          mimeEnc: true,
          size: true,
          chunkCount: true,
          chunkSize: true,
          pwVerifier: true,
          expiresAt: true,
          maxDownloads: true,
          downloadCount: true,
          status: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      prisma.file.count({ where: whereClause }),
    ]);

    const formattedFiles = files.map((f) => ({
      id: f.id,
      code: f.code,
      nameEnc: f.nameEnc,
      mimeEnc: f.mimeEnc,
      size: f.size.toString(),
      chunkCount: f.chunkCount,
      chunkSize: f.chunkSize,
      passwordRequired: !!f.pwVerifier,
      expiresAt: f.expiresAt,
      maxDownloads: f.maxDownloads,
      downloadCount: f.downloadCount,
      status: f.status,
      createdAt: f.createdAt,
      deletedAt: f.deletedAt,
    }));

    res.json({
      files: formattedFiles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v1/me/stats
 * Aggregates statistics: used storage, total files, total downloads.
 */
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    const files = await prisma.file.findMany({
      where: { ownerId: user.id },
      select: {
        size: true,
        downloadCount: true,
        status: true,
      },
    });

    let totalUsedBytes = BigInt(0);
    let activeFiles = 0;
    let trashedFiles = 0;
    let expiredFiles = 0;
    let totalDownloads = 0;

    for (const f of files) {
      if (f.status === 'active') {
        totalUsedBytes += BigInt(f.size);
        activeFiles++;
      } else if (f.status === 'trashed') {
        trashedFiles++;
      } else if (f.status === 'expired') {
        expiredFiles++;
      }
      totalDownloads += f.downloadCount;
    }

    res.json({
      totalUsedBytes: totalUsedBytes.toString(),
      activeFiles,
      trashedFiles,
      expiredFiles,
      totalDownloads,
    });
  } catch (err: any) {
    next(err);
  }
});

export const userRoutes = router;
