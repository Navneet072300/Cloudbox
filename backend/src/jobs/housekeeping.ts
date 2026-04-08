import { schedule } from 'node-cron';
import { prisma } from '../infrastructure/database/prisma';
import { storage } from '../infrastructure/storage/s3';
import { logger } from '../utils/logger';

export function startHousekeepingJobs(): void {
  // Expire abandoned upload sessions every hour
  schedule('0 * * * *', async () => {
    try {
      const r = await prisma.uploadSession.updateMany({
        where: { status: 'IN_PROGRESS', expiresAt: { lt: new Date() } },
        data:  { status: 'EXPIRED' },
      });
      logger.info({ count: r.count }, 'Expired upload sessions cleaned');
    } catch (err) { logger.error({ err }, 'Upload session expiry job failed'); }
  });

  // Purge trash (soft-deleted > 30 days) nightly at 2am
  schedule('0 2 * * *', async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const files = await prisma.file.findMany({
        where: { isDeleted: true, deletedAt: { lt: cutoff } },
        select: { id: true, storageKey: true },
      });

      for (let i = 0; i < files.length; i += 50) {
        const batch = files.slice(i, i + 50);
        await Promise.allSettled(
          batch.map(async (f) => {
            const refs = await prisma.file.count({ where: { storageKey: f.storageKey, isDeleted: false } });
            if (refs === 0) await storage.deleteObject(f.storageKey);
          })
        );
        await prisma.file.deleteMany({ where: { id: { in: batch.map((f) => f.id) } } });
      }

      logger.info({ deleted: files.length }, 'Trash purged');
    } catch (err) { logger.error({ err }, 'Trash purge failed'); }
  });

  // Revoke expired refresh tokens daily at 3am
  schedule('0 3 * * *', async () => {
    try {
      const r = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      logger.info({ deleted: r.count }, 'Expired refresh tokens cleaned');
    } catch (err) { logger.error({ err }, 'Token cleanup failed'); }
  });

  // Deactivate expired shares daily at 4am
  schedule('0 4 * * *', async () => {
    try {
      const r = await prisma.share.updateMany({
        where: { isActive: true, expiresAt: { lt: new Date() } },
        data:  { isActive: false },
      });
      logger.info({ deactivated: r.count }, 'Expired shares deactivated');
    } catch (err) { logger.error({ err }, 'Share expiry job failed'); }
  });

  logger.info('Housekeeping jobs scheduled');
}
