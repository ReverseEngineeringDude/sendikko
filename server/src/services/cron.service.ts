import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { telegramService } from './telegram.service.js';
import { logger } from '../utils/logger.js';

export class CronService {
  public static init(): void {
    logger.info('Initializing Sendikko scheduled cron tasks');

    // Run every 10 minutes: Expire active files whose expiresAt has passed
    cron.schedule('*/10 * * * *', async () => {
      try {
        const now = new Date();
        const expired = await prisma.file.updateMany({
          where: {
            status: 'active',
            expiresAt: { lte: now },
          },
          data: { status: 'expired' },
        });

        if (expired.count > 0) {
          logger.info({ count: expired.count }, 'Marked expired files as expired');
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error during file expiration cron job');
      }
    });

    // Run every hour: Purge abandoned upload sessions older than 2 hours
    cron.schedule('0 * * * *', async () => {
      try {
        const now = new Date();
        const abandonedSessions = await prisma.uploadSession.findMany({
          where: {
            state: 'in_progress',
            expiresAt: { lte: now },
          },
          include: {
            file: {
              include: { chunks: true },
            },
          },
        });

        for (const session of abandonedSessions) {
          // If file was never completed, clean up any uploaded chunks
          if (session.file.status === 'uploading') {
            for (const chunk of session.file.chunks) {
              await telegramService.deleteChunkMessage(chunk.tgMessageId);
            }
            await prisma.file.delete({ where: { id: session.fileId } });
          } else {
            await prisma.uploadSession.delete({ where: { id: session.id } });
          }
        }

        if (abandonedSessions.length > 0) {
          logger.info({ count: abandonedSessions.length }, 'Cleaned up abandoned upload sessions');
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error purging abandoned upload sessions');
      }
    });

    // Run daily at 03:00 AM: Purge files from trash older than 7 days
    cron.schedule('0 3 * * *', async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trashedFiles = await prisma.file.findMany({
          where: {
            status: 'trashed',
            deletedAt: { lte: sevenDaysAgo },
          },
          include: { chunks: true },
        });

        for (const file of trashedFiles) {
          for (const chunk of file.chunks) {
            const success = await telegramService.deleteChunkMessage(chunk.tgMessageId);
            if (!success) {
              // Enqueue for retry
              await prisma.telegramCleanupQueue.create({
                data: { tgMessageId: chunk.tgMessageId },
              });
            }
          }
          await prisma.file.delete({ where: { id: file.id } });
        }

        if (trashedFiles.length > 0) {
          logger.info({ count: trashedFiles.length }, 'Purged trashed files older than 7 days');
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error in trash purge cron job');
      }
    });

    // Run every 30 minutes: Process Telegram cleanup retry queue
    cron.schedule('*/30 * * * *', async () => {
      try {
        const queueItems = await prisma.telegramCleanupQueue.findMany({
          take: 50,
          orderBy: { createdAt: 'asc' },
        });

        for (const item of queueItems) {
          const success = await telegramService.deleteChunkMessage(item.tgMessageId);
          if (success || item.retryCount >= 5) {
            await prisma.telegramCleanupQueue.delete({ where: { id: item.id } });
          } else {
            await prisma.telegramCleanupQueue.update({
              where: { id: item.id },
              data: { retryCount: item.retryCount + 1 },
            });
          }
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error processing Telegram cleanup retry queue');
      }
    });
  }
}
