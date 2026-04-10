'use client';
import { useCallback } from 'react';
import SparkMD5 from 'spark-md5';
import { filesApi } from '@/lib/api';
import { useUploadStore } from '@/store/uploadStore';
import { useQueryClient } from '@tanstack/react-query';

const CHUNK_SIZE         = 10 * 1024 * 1024; // must match backend
const CONCURRENT_CHUNKS  = 3;

export function useUpload(folderId: string | null) {
  const { addItems, updateItem } = useUploadStore();
  const queryClient = useQueryClient();

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const uuid = () => typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      const items = files.map((file) => ({
        id:        uuid(),
        file,
        folderId,
        sessionId: null,
        progress:  0,
        status:    'queued' as const,
      }));

      addItems(items);

      // Upload files with max 2 concurrent
      const sem = new Semaphore(2);
      await Promise.all(items.map((item) => sem.run(() => uploadOne(item.id, item.file))));
    },
    [folderId, addItems]
  );

  const uploadOne = async (itemId: string, file: File) => {
    try {
      // Hash
      updateItem(itemId, { status: 'hashing', progress: 0 });
      const checksum = await hashFile(file, (p) =>
        updateItem(itemId, { progress: Math.round(p * 8) })
      );

      // Init upload session
      const { data: session } = await filesApi.initiateUpload({
        fileName: file.name,
        folderId,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      updateItem(itemId, { sessionId: session.sessionId, status: 'uploading', progress: 10 });

      // Upload chunks in batches
      let done = 0;
      const { chunkUrls, totalChunks, chunkSize, sessionId } = session;

      for (let i = 0; i < chunkUrls.length; i += CONCURRENT_CHUNKS) {
        const batch = chunkUrls.slice(i, i + CONCURRENT_CHUNKS);
        await Promise.all(
          batch.map(async ({ partNumber, url, size }) => {
            const start = (partNumber - 1) * chunkSize;
            const chunk = file.slice(start, start + size);

            const res = await fetch(url, {
              method:  'PUT',
              body:    chunk,
              headers: { 'Content-Type': 'application/octet-stream' },
            });
            if (!res.ok) throw new Error(`Chunk ${partNumber} failed: ${res.status}`);

            const etag = res.headers.get('ETag') ?? '';
            await filesApi.confirmChunk(sessionId, partNumber, etag);

            done++;
            updateItem(itemId, { progress: 10 + Math.round((done / totalChunks) * 80) });
          })
        );
      }

      // Assemble
      updateItem(itemId, { status: 'assembling', progress: 92 });
      await filesApi.completeUpload(sessionId, checksum);

      updateItem(itemId, { status: 'done', progress: 100 });
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
    } catch (err: any) {
      updateItem(itemId, {
        status: 'error',
        error:  err?.response?.data?.error ?? err.message ?? 'Upload failed',
      });
    }
  };

  return { uploadFiles };
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function hashFile(file: File, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const SLICE  = 2 * 1024 * 1024;
    const spark  = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();
    let offset   = 0;

    const next = () => reader.readAsArrayBuffer(file.slice(offset, offset + SLICE));

    reader.onload = (e) => {
      spark.append(e.target!.result as ArrayBuffer);
      offset += SLICE;
      onProgress?.(offset / file.size);
      offset < file.size ? next() : resolve(spark.end());
    };
    reader.onerror = reject;
    next();
  });
}

class Semaphore {
  private count: number;
  private q: Array<() => void> = [];
  constructor(n: number) { this.count = n; }
  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((res, rej) => {
      const attempt = () => {
        if (this.count > 0) {
          this.count--;
          fn().then(res, rej).finally(() => { this.count++; this.q.shift()?.(); });
        } else {
          this.q.push(attempt);
        }
      };
      attempt();
    });
  }
}
