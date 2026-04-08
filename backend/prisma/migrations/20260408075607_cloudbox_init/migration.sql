-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ASSEMBLING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShareType" AS ENUM ('PUBLIC_LINK', 'PRIVATE_INVITE');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW', 'EDIT', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "storageUsed" BIGINT NOT NULL DEFAULT 0,
    "storageQuota" BIGINT NOT NULL DEFAULT 5368709120,
    "avatarUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUid" TEXT NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "folderId" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "vectorClock" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "size" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT,
    "fileName" TEXT NOT NULL,
    "folderId" TEXT,
    "mimeType" TEXT NOT NULL,
    "totalSize" BIGINT NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "s3UploadId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedChunks" JSONB NOT NULL DEFAULT '[]',
    "baseVersionNum" INTEGER NOT NULL DEFAULT 0,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" TEXT NOT NULL,
    "fileId" TEXT,
    "folderId" TEXT,
    "ownerId" TEXT NOT NULL,
    "type" "ShareType" NOT NULL,
    "token" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_members" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'VIEW',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerUid_key" ON "oauth_accounts"("provider", "providerUid");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "folders_ownerId_idx" ON "folders"("ownerId");

-- CreateIndex
CREATE INDEX "folders_path_idx" ON "folders"("path");

-- CreateIndex
CREATE UNIQUE INDEX "folders_parentId_name_ownerId_key" ON "folders"("parentId", "name", "ownerId");

-- CreateIndex
CREATE INDEX "files_ownerId_idx" ON "files"("ownerId");

-- CreateIndex
CREATE INDEX "files_checksum_idx" ON "files"("checksum");

-- CreateIndex
CREATE INDEX "files_folderId_idx" ON "files"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "files_folderId_name_ownerId_key" ON "files"("folderId", "name", "ownerId");

-- CreateIndex
CREATE INDEX "file_versions_fileId_idx" ON "file_versions"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_fileId_versionNum_key" ON "file_versions"("fileId", "versionNum");

-- CreateIndex
CREATE INDEX "upload_sessions_userId_idx" ON "upload_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_key" ON "shares"("token");

-- CreateIndex
CREATE INDEX "shares_token_idx" ON "shares"("token");

-- CreateIndex
CREATE INDEX "shares_ownerId_idx" ON "shares"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "share_members_shareId_userId_key" ON "share_members"("shareId", "userId");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_members" ADD CONSTRAINT "share_members_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_members" ADD CONSTRAINT "share_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
