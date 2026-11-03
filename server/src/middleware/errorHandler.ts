import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  logger.error(
    {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      code,
      message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
    'Handled HTTP error'
  );

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : message,
      details: err.details,
    },
  });
}
