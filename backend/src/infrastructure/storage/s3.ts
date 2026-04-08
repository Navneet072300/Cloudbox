import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  UploadPartCopyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(process.env.S3_ENDPOINT
    ? {
        endpoint:        process.env.S3_ENDPOINT,
        forcePathStyle:  true,
        credentials: {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? 'minioadmin',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin',
        },
      }
    : {}),
});

const BUCKET  = process.env.S3_BUCKET ?? 'dropbox-dev';
const URL_TTL = 3600; // presigned URL valid for 1 hour

export const storage = {
  async createMultipartUpload(key: string, mimeType: string): Promise<string> {
    const cmd = new CreateMultipartUploadCommand({
      Bucket:             BUCKET,
      Key:                key,
      ContentType:        mimeType,
      ServerSideEncryption: 'AES256',
    });
    const res = await s3.send(cmd);
    return res.UploadId!;
  },

  async getPresignedUploadUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    return getSignedUrl(
      s3,
      new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: URL_TTL }
    );
  },

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<void> {
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket:          BUCKET,
        Key:             key,
        UploadId:        uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  },

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }));
  },

  async getPresignedDownloadUrl(key: string, fileName: string): Promise<string> {
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key:    key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      }),
      { expiresIn: URL_TTL }
    );
  },

  async deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },

  async objectExists(key: string): Promise<boolean> {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  },

  async getObjectSize(key: string): Promise<number> {
    const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return res.ContentLength ?? 0;
  },

  async listAllObjects(): Promise<Array<{ key: string; size?: number }>> {
    const objects: Array<{ key: string; size?: number }> = [];
    let token: string | undefined;

    do {
      const res = await s3.send(
        new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) objects.push({ key: obj.Key, size: obj.Size });
      }
      token = res.NextContinuationToken;
    } while (token);

    return objects;
  },

  async copyPart(params: {
    sourceKey:       string;
    targetKey:       string;
    uploadId:        string;
    partNumber:      number;
    copySourceRange?: string;
  }): Promise<string> {
    const res = await s3.send(
      new UploadPartCopyCommand({
        Bucket:               BUCKET,
        Key:                  params.targetKey,
        UploadId:             params.uploadId,
        PartNumber:           params.partNumber,
        CopySource:           `${BUCKET}/${params.sourceKey}`,
        CopySourceRange:      params.copySourceRange,
      })
    );
    return res.CopyPartResult?.ETag ?? '';
  },

  generateKey(userId: string, fileId: string): string {
    const now = new Date();
    return `files/${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileId}`;
  },
};
