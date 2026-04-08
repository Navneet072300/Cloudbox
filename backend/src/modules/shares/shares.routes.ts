import { Router } from 'express';
import { z } from 'zod';
import { SharesService } from './shares.service';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

const router  = Router();
const service = new SharesService();

// Helper: Express v5 types params as string | string[]; Zod validation guarantees string.
const str = (p: string | string[]): string => p as string;

// Create share (authenticated)
router.post('/',
  authenticate,
  validate(z.object({
    body: z.object({
      fileId:     z.string().uuid().optional(),
      folderId:   z.string().uuid().optional(),
      type:       z.enum(['PUBLIC_LINK', 'PRIVATE_INVITE']).default('PUBLIC_LINK'),
      permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
      expiresAt:  z.string().datetime().optional(),
      password:   z.string().min(4).optional(),
    }),
  })),
  async (req, res, next) => {
    try {
      const share = await service.create({ userId: req.user.id, ...req.body });
      res.status(201).json(share);
    } catch (err) { next(err); }
  }
);

// List my shares (authenticated)
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const shares = await service.listMyShares(req.user.id);
    res.json(shares);
  } catch (err) { next(err); }
});

// Access public share (unauthenticated)
router.get('/:token/access',
  validate(z.object({
    params: z.object({ token: z.string().min(1) }),
    body:   z.object({ password: z.string().optional() }).optional(),
  })),
  async (req, res, next) => {
    try {
      const password = req.query.password as string | undefined;
      const result   = await service.accessByToken(str(req.params.token), password);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// Revoke share (authenticated)
router.delete('/:shareId', authenticate, async (req, res, next) => {
  try {
    await service.revoke(str(req.params.shareId), req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
