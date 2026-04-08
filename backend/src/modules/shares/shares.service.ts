import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../infrastructure/database/prisma';
import { storage } from '../../infrastructure/storage/s3';
import { AppError } from '../../shared/errors';

export class SharesService {
  async create(params: {
    userId:     string;
    fileId?:    string;
    folderId?:  string;
    type:       'PUBLIC_LINK' | 'PRIVATE_INVITE';
    permission: 'VIEW' | 'EDIT';
    expiresAt?: string;
    password?:  string;
  }) {
    const { userId, fileId, folderId, type, permission, expiresAt, password } = params;

    if (!fileId && !folderId) throw new AppError('fileId or folderId required', 400);

    if (fileId) {
      const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId, isDeleted: false } });
      if (!file) throw new AppError('File not found', 404);
    }
    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, ownerId: userId, isDeleted: false } });
      if (!folder) throw new AppError('Folder not found', 404);
    }

    const token        = crypto.randomBytes(32).toString('base64url');
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const share = await prisma.share.create({
      data: {
        fileId, folderId, ownerId: userId, type, permission, token,
        password: passwordHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return { ...share, token };
  }

  async accessByToken(token: string, password?: string) {
    const share = await prisma.share.findUnique({
      where: { token },
      include: {
        file:   { select: { id: true, name: true, size: true, mimeType: true, storageKey: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    if (!share || !share.isActive) throw new AppError('Share not found', 404);
    if (share.expiresAt && share.expiresAt < new Date()) throw new AppError('Share expired', 410);

    if (share.password) {
      if (!password) throw new AppError('Password required', 401);
      const valid = await bcrypt.compare(password, share.password);
      if (!valid)  throw new AppError('Invalid password', 401);
    }

    await prisma.share.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 } } });

    if (share.file) {
      const url = await storage.getPresignedDownloadUrl(share.file.storageKey, share.file.name);
      return { share: { id: share.id, permission: share.permission, type: share.type }, file: { ...share.file, url, size: Number(share.file.size) } };
    }

    return { share: { id: share.id, permission: share.permission, type: share.type }, folder: share.folder };
  }

  async listMyShares(userId: string) {
    const shares = await prisma.share.findMany({
      where: { ownerId: userId, isActive: true },
      include: {
        file:   { select: { name: true } },
        folder: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return shares;
  }

  async revoke(shareId: string, userId: string) {
    const share = await prisma.share.findFirst({ where: { id: shareId, ownerId: userId } });
    if (!share) throw new AppError('Share not found', 404);
    await prisma.share.update({ where: { id: shareId }, data: { isActive: false } });
  }
}
