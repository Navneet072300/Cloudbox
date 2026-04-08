import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, 'Application error');
    }
    res.status(err.statusCode).json({ error: err.message, requestId });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error:  'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      requestId,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Resource already exists', requestId });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Resource not found', requestId });
      return;
    }
  }

  logger.error({ err, requestId, stack: err.stack }, 'Unhandled error');

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId,
  });
}
