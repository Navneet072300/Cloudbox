import { Router } from 'express';
import { z } from 'zod';
import { FoldersService } from './folders.service';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

const router  = Router();
const service = new FoldersService();

// Helper: Express v5 types params as string | string[]; Zod validation guarantees string.
const str = (p: string | string[]): string => p as string;

router.use(authenticate);

router.post('/',
  validate(z.object({
    body: z.object({
      name:     z.string().min(1).max(255),
      parentId: z.string().uuid().nullable().default(null),
    }),
  })),
  async (req, res, next) => {
    try {
      const folder = await service.create(req.user.id, req.body.name, req.body.parentId);
      res.status(201).json(folder);
    } catch (err) { next(err); }
  }
);

router.get('/:folderId', async (req, res, next) => {
  try {
    const folder = await service.get(str(req.params.folderId), req.user.id);
    res.json(folder);
  } catch (err) { next(err); }
});

router.patch('/:folderId',
  validate(z.object({
    params: z.object({ folderId: z.string().uuid() }),
    body:   z.object({ name: z.string().min(1).max(255) }),
  })),
  async (req, res, next) => {
    try {
      const folder = await service.rename(str(req.params.folderId), req.user.id, req.body.name);
      res.json(folder);
    } catch (err) { next(err); }
  }
);

router.delete('/:folderId', async (req, res, next) => {
  try {
    await service.delete(str(req.params.folderId), req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
