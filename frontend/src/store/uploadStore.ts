'use client';
import { create } from 'zustand';

export type UploadStatus = 'queued' | 'hashing' | 'uploading' | 'assembling' | 'done' | 'error';

export interface UploadItem {
  id:        string;
  file:      File;
  folderId:  string | null;
  sessionId: string | null;
  progress:  number;
  status:    UploadStatus;
  error?:    string;
}

interface UploadStore {
  queue:          UploadItem[];
  addItems:       (items: UploadItem[]) => void;
  updateItem:     (id: string, patch: Partial<UploadItem>) => void;
  removeItem:     (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  queue: [],

  addItems: (items) =>
    set((s) => ({ queue: [...s.queue, ...items] })),

  updateItem: (id, patch) =>
    set((s) => ({ queue: s.queue.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

  removeItem: (id) =>
    set((s) => ({ queue: s.queue.filter((i) => i.id !== id) })),

  clearCompleted: () =>
    set((s) => ({ queue: s.queue.filter((i) => i.status !== 'done') })),
}));
