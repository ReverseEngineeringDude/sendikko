import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from './config/index.js';
import { authRoutes } from './routes/auth.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';
import { fileRoutes } from './routes/file.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { telegramService } from './services/telegram.service.js';
import { prisma } from './utils/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();

  // Trust proxy for rate-limiting behind reverse proxies / fly / render
  app.set('trust proxy', 1);

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind utility classes
          imgSrc: ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com', 'https://*.googleusercontent.com'],
          connectSrc: [
            "'self'",
            config.CLIENT_URL,
            'https://accounts.google.com',
            'https://*.googleapis.com',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://ipinfo.io',
          ],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = [
          config.CLIENT_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'https://sendikko.web.app',
          'https://sendikko.firebaseapp.com',
          'https://sendikko-8b6e6.web.app',
          'https://sendikko-8b6e6.firebaseapp.com',
        ];
        if (
          allowed.includes(origin) ||
          origin.endsWith('.web.app') ||
          origin.endsWith('.firebaseapp.com') ||
          origin.endsWith('.onrender.com')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Chunk-IV',
        'X-Chunk-SHA256',
        'X-Chunk-Size',
        'X-Download-Token',
        'Range',
      ],
      exposedHeaders: [
        'Content-Range',
        'Content-Length',
        'Accept-Ranges',
        'X-Chunk-Index',
        'X-Chunk-IV',
        'X-Chunk-SHA256',
      ],
    })
  );

  // Cookie Parser
  app.use(cookieParser(config.COOKIE_SECRET));

  // JSON Body Parser (skip for raw multipart chunk uploads handled by multer)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health Check Endpoint
  app.get('/health', async (_req, res) => {
    let dbStatus = 'ok';
    let dbError = undefined;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      dbStatus = 'error';
      dbError = err.message;
    }

    const tgHealth = await telegramService.testConnection();

    res.json({
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      service: 'Sendikko API',
      timestamp: new Date().toISOString(),
      database: { status: dbStatus, error: dbError },
      telegram: tgHealth,
    });
  });

  // REST API Routes under /api/v1
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/uploads', uploadRoutes);
  app.use('/api/v1/files', fileRoutes);
  app.use('/api/v1/me', userRoutes);

  // Serve frontend static build if present (e.g. Unified deployment on Render)
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // 404 Handler for unhandled API routes
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route was not found',
      },
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
