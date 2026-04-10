import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  const date   = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return formatDistanceToNow(date, { addSuffix: true });
  return format(date, 'MMM d, yyyy');
}

export function getFileIcon(mimeType: string): 'image' | 'video' | 'audio' | 'archive' | 'doc' {
  if (mimeType.startsWith('image/'))      return 'image';
  if (mimeType.startsWith('video/'))      return 'video';
  if (mimeType.startsWith('audio/'))      return 'audio';
  if (/zip|tar|gz|rar|7z/.test(mimeType)) return 'archive';
  return 'doc';
}

export function generateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const stored = localStorage.getItem('deviceId');
  if (stored) return stored;
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  localStorage.setItem('deviceId', id);
  return id;
}
