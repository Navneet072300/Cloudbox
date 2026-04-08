import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuid();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level =
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]({
      requestId,
      method:     req.method,
      url:        req.url,
      status:     res.statusCode,
      duration,
      userId:     (req as any).user?.id,
      ip:         req.ip,
    }, `${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
}
