import { v4 as uuid } from 'uuid';
import { prisma } from '../../infrastructure/database/prisma';
import { storage } from '../../infrastructure/storage/s3';
import { cache } from '../../infrastructure/cache/redis';
import { publishEvent } from '../../infrastructure/queue/kafka';
import { AppError } from '../../shared/errors';

const CHUNK_SIZE        = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE     = 5 * 1024 * 1024 * 1024; // 5GB
const MAX_VERSIONS      = 10;
const UPLOAD_EXPIRY_HRS = 24;

export class FilesService {
  // ─── Initiate chunked upload ──────────────────────────────────────
  async initiateUpload(params: {
    userId:   string;
    fileName: string;
    folderId: string | null;
    mimeType: string;
    fileSize: number;
  }) {
    const { userId, fileName, folderId, mimeType, fileSize } = params;

    if (fileSize > MAX_FILE_SIZE) throw new AppError('File exceeds 5GB limit', 413);
    await this.checkQuota(userId, fileSize);
    if (folderId) await this.verifyFolderAccess(userId, folderId);

    const fileId     = uuid();
    const sessionId  = uuid();
    const storageKey = storage.generateKey(userId, fileId);
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    const s3UploadId = await storage.createMultipartUpload(storageKey, mimeType);

    const chunkUrls = await Promise.all(
      Array.from({ length: totalChunks }, (_, i) =>
        storage.getPresignedUploadUrl(storageKey, s3UploadId, i + 1).then((url) => ({
          partNumber: i + 1,
          url,
          size: i === totalChunks - 1 ? fileSize - i * CHUNK_SIZE : CHUNK_SIZE,
        }))
      )
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + UPLOAD_EXPIRY_HRS);

    await prisma.uploadSession.create({
      data: {
        id: sessionId, userId, fileId, fileName, folderId,
        mimeType, totalSize: fileSize, totalChunks, chunkSize: CHUNK_SIZE,
        s3UploadId, storageKey, status: 'IN_PROGRESS', expiresAt,
      },
    });

    return { sessionId, fileId, chunkUrls, totalChunks, chunkSize: CHUNK_SIZE };
  }

  // ─── Confirm a single chunk ───────────────────────────────────────
  async confirmChunk(sessionId: string, userId: string, partNumber: number, etag: string) {
    const session = await prisma.uploadSession.findFirst({
      where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    });
    if (!session) throw new AppError('Upload session not found', 404);

    const chunks = session.uploadedChunks as Array<{ PartNumber: number; ETag: string }>;
    if (!chunks.find((c) => c.PartNumber === partNumber)) {
      chunks.push({ PartNumber: partNumber, ETag: etag });
      chunks.sort((a, b) => a.PartNumber - b.PartNumber);
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data:  { uploadedChunks: chunks },
      });
    }

    return {
      confirmed:  chunks.length,
      total:      session.totalChunks,
      isComplete: chunks.length === session.totalChunks,
    };
  }

  // ─── Complete upload and assemble ─────────────────────────────────
  async completeUpload(sessionId: string, userId: string, checksum: string) {
    const session = await prisma.uploadSession.findFirst({
      where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    });
    if (!session) throw new AppError('Upload session not found', 404);

    const chunks = session.uploadedChunks as Array<{ PartNumber: number; ETag: string }>;
    if (chunks.length !== session.totalChunks) {
      throw new AppError(
        `Incomplete: ${chunks.length}/${session.totalChunks} chunks received`, 400
      );
    }

    await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'ASSEMBLING' } });

    try {
      await storage.completeMultipartUpload(session.storageKey, session.s3UploadId, chunks);

      // Deduplication: reuse existing S3 object if same content
      const duplicate = await prisma.file.findFirst({
        where: { checksum, ownerId: userId, isDeleted: false },
        select: { storageKey: true, id: true },
      });

      let resolvedStorageKey = session.storageKey;
      if (duplicate) {
        await storage.deleteObject(session.storageKey).catch(() => {});
        resolvedStorageKey = duplicate.storageKey;
      }

      const file = await this.upsertFile(session, resolvedStorageKey, checksum, userId);

      await prisma.$transaction([
        prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED', fileId: file.id } }),
        prisma.user.update({ where: { id: userId }, data: { storageUsed: { increment: session.totalSize } } }),
      ]);

      await publishEvent('file.uploaded', userId, {
        userId, fileId: file.id, folderId: session.folderId, action: 'created',
      });
      await cache.invalidatePattern(`folder:${session.folderId ?? 'root'}:${userId}:*`);

      return file;
    } catch (err) {
      await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } });
      throw err;
    }
  }

  // ─── Get resumable upload status ──────────────────────────────────
  async getUploadStatus(sessionId: string, userId: string) {
    const session = await prisma.uploadSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new AppError('Upload session not found', 404);

    const confirmed = (session.uploadedChunks as any[]).map((c) => c.PartNumber);
    const confirmedSet = new Set(confirmed);
    const missing = Array.from({ length: session.totalChunks }, (_, i) => i + 1)
      .filter((p) => !confirmedSet.has(p));

    const chunkUrls = await Promise.all(
      missing.map((p) =>
        storage.getPresignedUploadUrl(session.storageKey, session.s3UploadId, p).then((url) => ({
          partNumber: p, url,
        }))
      )
    );

    return {
      status:          session.status,
      confirmedChunks: confirmed.length,
      totalChunks:     session.totalChunks,
      missingChunks:   chunkUrls,
    };
  }

  // ─── Download ─────────────────────────────────────────────────────
  async getDownloadUrl(fileId: string, userId: string) {
    const file = await this.getFileWithAccess(fileId, userId);
    const cacheKey = `download:${fileId}:${userId}`;
    const cached   = await cache.get<string>(cacheKey);
    if (cached) return { url: cached, fileName: file.name };

    const url = await storage.getPresignedDownloadUrl(file.storageKey, file.name);
    await cache.set(cacheKey, url, 3000);
    return { url, fileName: file.name };
  }

  // ─── List folder contents ─────────────────────────────────────────
  async listFolder(userId: string, folderId: string | null, page = 1, limit = 50) {
    const cacheKey = `folder:${folderId ?? 'root'}:${userId}:${page}`;
    const cached   = await cache.get(cacheKey);
    if (cached) return cached;

    const [files, folders, total] = await prisma.$transaction([
      prisma.file.findMany({
        where: { ownerId: userId, folderId: folderId ?? null, isDeleted: false },
        select: { id: true, name: true, size: true, mimeType: true, checksum: true, createdAt: true, updatedAt: true, folderId: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.folder.findMany({
        where: { ownerId: userId, parentId: folderId ?? null, isDeleted: false },
        select: { id: true, name: true, createdAt: true, updatedAt: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.file.count({ where: { ownerId: userId, folderId: folderId ?? null, isDeleted: false } }),
    ]);

    const result = {
      files: files.map((f) => ({ ...f, size: Number(f.size) })),
      folders,
      total,
      page,
      limit,
    };
    await cache.set(cacheKey, result, 30);
    return result;
  }

  // ─── Soft delete ──────────────────────────────────────────────────
  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFileWithAccess(fileId, userId);
    await prisma.$transaction([
      prisma.file.update({ where: { id: fileId }, data: { isDeleted: true, deletedAt: new Date() } }),
      prisma.user.update({ where: { id: userId }, data: { storageUsed: { decrement: file.size } } }),
    ]);
    await cache.invalidatePattern(`folder:${file.folderId ?? 'root'}:${userId}:*`);
    await publishEvent('file.deleted', userId, { userId, fileId, folderId: file.folderId });
  }

  // ─── Versions ────────────────────────────────────────────────────
  async listVersions(fileId: string, userId: string) {
    await this.getFileWithAccess(fileId, userId);
    return prisma.fileVersion.findMany({
      where:   { fileId },
      orderBy: { versionNum: 'desc' },
      select: { id: true, versionNum: true, size: true, checksum: true, createdAt: true, uploadedBy: true },
    }).then((vs) => vs.map((v) => ({ ...v, size: Number(v.size) })));
  }

  async restoreVersion(fileId: string, versionId: string, userId: string) {
    const file    = await this.getFileWithAccess(fileId, userId);
    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId } });
    if (!version) throw new AppError('Version not found', 404);

    await prisma.$transaction(async (tx) => {
      const latest = await tx.fileVersion.findFirst({ where: { fileId }, orderBy: { versionNum: 'desc' } });
      await tx.fileVersion.create({
        data: {
          fileId,
          versionNum: (latest?.versionNum ?? 0) + 1,
          size:       file.size,
          checksum:   file.checksum,
          storageKey: file.storageKey,
          uploadedBy: userId,
        },
      });
      await tx.file.update({
        where: { id: fileId },
        data: { size: version.size, checksum: version.checksum, storageKey: version.storageKey },
      });
    });

    await cache.del(`download:${fileId}:${userId}`);
  }

  // ─── Private helpers ──────────────────────────────────────────────
  private async getFileWithAccess(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: userId, isDeleted: false },
    });
    if (!file) throw new AppError('File not found', 404);
    return file;
  }

  private async checkQuota(userId: string, fileSize: number) {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (!user) throw new AppError('User not found', 404);
    if (user.storageUsed + BigInt(fileSize) > user.storageQuota) {
      throw new AppError('Storage quota exceeded', 402);
    }
  }

  private async verifyFolderAccess(userId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, ownerId: userId, isDeleted: false } });
    if (!folder) throw new AppError('Folder not found', 404);
  }

  private async upsertFile(session: any, storageKey: string, checksum: string, userId: string) {
    const prev = await prisma.file.findFirst({
      where: { name: session.fileName, folderId: session.folderId ?? null, ownerId: userId, isDeleted: false },
    });

    if (prev) {
      return prisma.$transaction(async (tx) => {
        const latest = await tx.fileVersion.findFirst({ where: { fileId: prev.id }, orderBy: { versionNum: 'desc' } });
        const nextNum = (latest?.versionNum ?? 0) + 1;

        await tx.fileVersion.create({
          data: { fileId: prev.id, versionNum: nextNum, size: session.totalSize, checksum, storageKey, uploadedBy: userId },
        });

        // Prune beyond MAX_VERSIONS
        const all = await tx.fileVersion.findMany({ where: { fileId: prev.id }, orderBy: { versionNum: 'desc' } });
        if (all.length > MAX_VERSIONS) {
          const old = all.slice(MAX_VERSIONS);
          await tx.fileVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
          old.forEach((v) => storage.deleteObject(v.storageKey).catch(() => {}));
        }

        return tx.file.update({
          where: { id: prev.id },
          data: { size: session.totalSize, checksum, storageKey, updatedAt: new Date() },
        });
      });
    }

    return prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          id: session.fileId ?? uuid(),
          name: session.fileName, ownerId: userId, folderId: session.folderId ?? null,
          mimeType: session.mimeType, size: session.totalSize, checksum, storageKey,
        },
      });
      await tx.fileVersion.create({
        data: { fileId: file.id, versionNum: 1, size: session.totalSize, checksum, storageKey, uploadedBy: userId },
      });
      return file;
    });
  }
}
