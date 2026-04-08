import { Router } from 'express';
import { z } from 'zod';
import { FilesService } from './files.service';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { uploadLimiter, downloadLimiter } from '../../middleware/rateLimit';

const router  = Router();
const service = new FilesService();

// Helper: Express v5 types params as string | string[]; Zod validation guarantees string.
const str = (p: string | string[]): string => p as string;

router.use(authenticate);

// Init upload
router.post('/upload/init',
  uploadLimiter,
  validate(z.object({
    body: z.object({
      fileName: z.string().min(1).max(255),
      folderId: z.string().uuid().nullable().default(null),
      mimeType: z.string().default('application/octet-stream'),
      fileSize: z.number().int().positive().max(5 * 1024 * 1024 * 1024),
    }),
  })),
  async (req, res, next) => {
    try {
      const result = await service.initiateUpload({ userId: req.user.id, ...req.body });
      res.status(201).json(result);
    } catch (err) { next(err); }
  }
);

// Confirm chunk
router.post('/upload/:sessionId/chunk',
  validate(z.object({
    params: z.object({ sessionId: z.string().uuid() }),
    body:   z.object({ partNumber: z.number().int().min(1), etag: z.string() }),
  })),
  async (req, res, next) => {
    try {
      const r = await service.confirmChunk(str(req.params.sessionId), req.user.id, req.body.partNumber, req.body.etag);
      res.json(r);
    } catch (err) { next(err); }
  }
);

// Complete upload
router.post('/upload/:sessionId/complete',
  validate(z.object({
    params: z.object({ sessionId: z.string().uuid() }),
    body:   z.object({ checksum: z.string().min(32) }),
  })),
  async (req, res, next) => {
    try {
      const file = await service.completeUpload(str(req.params.sessionId), req.user.id, req.body.checksum);
      res.json(file);
    } catch (err) { next(err); }
  }
);

// Upload status (resume)
router.get('/upload/:sessionId/status', async (req, res, next) => {
  try {
    const r = await service.getUploadStatus(str(req.params.sessionId), req.user.id);
    res.json(r);
  } catch (err) { next(err); }
});

// List folder
router.get('/', async (req, res, next) => {
  try {
    const folderId = (req.query.folderId as string) || null;
    const page     = Number(req.query.page)  || 1;
    const limit    = Math.min(Number(req.query.limit) || 50, 100);
    const r = await service.listFolder(req.user.id, folderId, page, limit);
    res.json(r);
  } catch (err) { next(err); }
});

// Download URL
router.get('/:fileId/download', downloadLimiter, async (req, res, next) => {
  try {
    const r = await service.getDownloadUrl(str(req.params.fileId), req.user.id);
    res.json(r);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:fileId', async (req, res, next) => {
  try {
    await service.deleteFile(str(req.params.fileId), req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// List versions
router.get('/:fileId/versions', async (req, res, next) => {
  try {
    const r = await service.listVersions(str(req.params.fileId), req.user.id);
    res.json(r);
  } catch (err) { next(err); }
});

// Restore version
router.post('/:fileId/versions/:versionId/restore', async (req, res, next) => {
  try {
    await service.restoreVersion(str(req.params.fileId), str(req.params.versionId), req.user.id);
    res.json({ message: 'Version restored' });
  } catch (err) { next(err); }
});

export default router;
