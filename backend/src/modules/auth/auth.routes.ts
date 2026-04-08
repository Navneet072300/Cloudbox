import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter } from '../../middleware/rateLimit';

const router  = Router();
const service = new AuthService();

const registerSchema = z.object({
  body: z.object({
    email:    z.string().email(),
    password: z.string().min(8).max(128),
    name:     z.string().min(1).max(100),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email:    z.string().email(),
    password: z.string().min(1),
    deviceId: z.string().optional(),
  }),
});

const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1) }),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const user = await service.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json(user);
  } catch (err) { next(err); }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const deviceId  = req.body.deviceId;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    const result    = await service.login(req.body.email, req.body.password, deviceId, userAgent, ipAddress);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await service.refreshTokens(req.body.refreshToken);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await service.logout(refreshToken);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await service.getMe(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
