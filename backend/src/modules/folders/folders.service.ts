import { prisma } from '../../infrastructure/database/prisma';
import { cache } from '../../infrastructure/cache/redis';
import { AppError } from '../../shared/errors';

export class FoldersService {
  async create(userId: string, name: string, parentId: string | null) {
    if (parentId) {
      const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId: userId, isDeleted: false } });
      if (!parent) throw new AppError('Parent folder not found', 404);
    }

    const existing = await prisma.folder.findFirst({
      where: { name, ownerId: userId, parentId: parentId ?? null, isDeleted: false },
    });
    if (existing) throw new AppError('A folder with this name already exists', 409);

    const parentPath = parentId
      ? (await prisma.folder.findUnique({ where: { id: parentId }, select: { path: true } }))?.path ?? '/'
      : '/';

    const folder = await prisma.folder.create({
      data: { name, ownerId: userId, parentId, path: `${parentPath}${name}/` },
    });

    await cache.invalidatePattern(`folder:${parentId ?? 'root'}:${userId}:*`);
    return folder;
  }

  async rename(folderId: string, userId: string, name: string) {
    const folder = await this.getWithAccess(folderId, userId);

    await prisma.folder.update({ where: { id: folderId }, data: { name } });
    await cache.invalidatePattern(`folder:${folder.parentId ?? 'root'}:${userId}:*`);
    return { ...folder, name };
  }

  async delete(folderId: string, userId: string) {
    const folder = await this.getWithAccess(folderId, userId);

    // Soft-delete folder and all children recursively
    await prisma.folder.updateMany({
      where: { path: { startsWith: folder.path }, ownerId: userId },
      data:  { isDeleted: true, deletedAt: new Date() },
    });

    // Soft-delete all files in the subtree
    const subFolderIds = await prisma.folder.findMany({
      where:  { path: { startsWith: folder.path }, ownerId: userId },
      select: { id: true },
    }).then((fs) => fs.map((f) => f.id));

    await prisma.file.updateMany({
      where: { folderId: { in: subFolderIds }, ownerId: userId },
      data:  { isDeleted: true, deletedAt: new Date() },
    });

    await cache.invalidatePattern(`folder:${folder.parentId ?? 'root'}:${userId}:*`);
  }

  async get(folderId: string, userId: string) {
    return this.getWithAccess(folderId, userId);
  }

  private async getWithAccess(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, ownerId: userId, isDeleted: false },
    });
    if (!folder) throw new AppError('Folder not found', 404);
    return folder;
  }
}
