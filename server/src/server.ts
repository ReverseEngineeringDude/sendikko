import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { CronService } from './services/cron.service.js';
import { prisma } from './utils/prisma.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`Sendikko API server running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
  
  // Start background cron jobs
  CronService.init();
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Gracefully terminating Sendikko server...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
