import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let queue: Array<{ resolve: Function; reject: Function }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject })).then(
          (token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); }
        );
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        queue.forEach(({ resolve }) => resolve(data.accessToken));
        queue = [];

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        queue.forEach(({ reject }) => reject(error));
        queue = [];
        localStorage.clear();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API helpers ────────────────────────────────────────────────

export const authApi = {
  register:  (email: string, password: string, name: string) =>
    api.post<{ id: string; email: string; name: string }>('/auth/register', { email, password, name }),
  login:     (email: string, password: string, deviceId: string) =>
    api.post<TokenPair>('/auth/login', { email, password, deviceId }),
  refresh:   (refreshToken: string) =>
    api.post<TokenPair>('/auth/refresh', { refreshToken }),
  logout:    (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me:        () =>
    api.get<UserProfile>('/auth/me'),
};

export const filesApi = {
  list:          (folderId: string | null, page = 1) =>
    api.get<FolderContents>('/files', { params: { folderId, page } }),
  initiateUpload: (payload: InitUploadPayload) =>
    api.post<InitUploadResult>('/files/upload/init', payload),
  confirmChunk:  (sessionId: string, partNumber: number, etag: string) =>
    api.post<ChunkProgress>(`/files/upload/${sessionId}/chunk`, { partNumber, etag }),
  completeUpload: (sessionId: string, checksum: string) =>
    api.post<FileRecord>(`/files/upload/${sessionId}/complete`, { checksum }),
  uploadStatus:  (sessionId: string) =>
    api.get<UploadStatus>(`/files/upload/${sessionId}/status`),
  downloadUrl:   (fileId: string) =>
    api.get<{ url: string; fileName: string }>(`/files/${fileId}/download`),
  deleteFile:    (fileId: string) =>
    api.delete(`/files/${fileId}`),
  listVersions:  (fileId: string) =>
    api.get<FileVersion[]>(`/files/${fileId}/versions`),
  restoreVersion: (fileId: string, versionId: string) =>
    api.post(`/files/${fileId}/versions/${versionId}/restore`),
};

export const foldersApi = {
  create: (name: string, parentId: string | null) =>
    api.post<FolderRecord>('/folders', { name, parentId }),
  get:    (folderId: string) =>
    api.get<FolderRecord>(`/folders/${folderId}`),
  rename: (folderId: string, name: string) =>
    api.patch(`/folders/${folderId}`, { name }),
  delete: (folderId: string) =>
    api.delete(`/folders/${folderId}`),
};

export const sharesApi = {
  create:     (payload: CreateSharePayload) =>
    api.post<ShareRecord>('/shares', payload),
  mine:       () =>
    api.get<ShareRecord[]>('/shares/mine'),
  access:     (token: string, password?: string) =>
    api.get<ShareAccessResult>(`/shares/${token}/access`, { params: { password } }),
  revoke:     (shareId: string) =>
    api.delete(`/shares/${shareId}`),
};

// ─── Types ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string; email: string; name: string;
  storageUsed: number; storageQuota: number; avatarUrl: string | null;
}
export interface TokenPair {
  accessToken: string; refreshToken: string; user: UserProfile;
}
export interface FileRecord {
  id: string; name: string; size: number; mimeType: string;
  checksum: string; folderId: string | null; createdAt: string; updatedAt: string;
}
export interface FolderRecord {
  id: string; name: string; parentId: string | null; createdAt: string; updatedAt: string;
}
export interface FolderContents {
  files: FileRecord[]; folders: FolderRecord[]; total: number; page: number; limit: number;
}
export interface InitUploadPayload {
  fileName: string; folderId: string | null; mimeType: string; fileSize: number;
}
export interface InitUploadResult {
  sessionId: string; fileId: string; totalChunks: number; chunkSize: number;
  chunkUrls: Array<{ partNumber: number; url: string; size: number }>;
}
export interface ChunkProgress { confirmed: number; total: number; isComplete: boolean; }
export interface UploadStatus {
  status: string; confirmedChunks: number; totalChunks: number;
  missingChunks: Array<{ partNumber: number; url: string }>;
}
export interface FileVersion {
  id: string; versionNum: number; size: number; checksum: string; createdAt: string; uploadedBy: string;
}
export interface ShareRecord {
  id: string; token: string; permission: string; type: string;
  expiresAt: string | null; isActive: boolean; downloadCount: number;
  file?: { name: string } | null; folder?: { name: string } | null;
}
export interface CreateSharePayload {
  fileId?: string; folderId?: string; type?: 'PUBLIC_LINK' | 'PRIVATE_INVITE';
  permission?: 'VIEW' | 'EDIT'; expiresAt?: string; password?: string;
}
export interface ShareAccessResult {
  share: { id: string; permission: string; type: string };
  file?: FileRecord & { url: string };
  folder?: FolderRecord;
}
