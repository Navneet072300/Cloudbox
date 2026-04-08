import { Request, Response, NextFunction } from 'express';
import { redis } from '../infrastructure/cache/redis';
import { AppError } from '../shared/errors';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs:  number;
  max:       number;
  keyFn?:    (req: Request) => string;
  message?:  string;
}

function rateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const baseKey = config.keyFn ? config.keyFn(req) : `rl:${req.ip}:${req.path}`;
    const windowSec = Math.ceil(config.windowMs / 1000);
    const now       = Date.now();
    const windowKey = `${baseKey}:${Math.floor(now / config.windowMs)}`;

    try {
      const count = await redis.incr(windowKey);
      if (count === 1) await redis.expire(windowKey, windowSec * 2);

      res.setHeader('X-RateLimit-Limit',     config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count));
      res.setHeader('X-RateLimit-Reset',     Math.ceil((now + config.windowMs) / 1000));

      if (count > config.max) {
        res.setHeader('Retry-After', windowSec);
        next(new AppError(config.message ?? 'Too many requests', 429));
        return;
      }
    } catch (err) {
      // Fail open if Redis is down — don't block users
      logger.error({ err }, 'Rate limiter error');
    }

    next();
  };
}

export const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  'Too many attempts. Please wait 15 minutes.',
});

export const uploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max:      100,
  keyFn:    (req) => `rl:upload:${req.user?.id ?? req.ip}`,
});

export const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max:      500,
  keyFn:    (req) => `rl:api:${req.user?.id ?? req.ip}`,
});

export const downloadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max:      200,
  keyFn:    (req) => `rl:dl:${req.user?.id ?? req.ip}`,
});
