import axios, { AxiosError } from 'axios';
import { FileMetadata, User, UserStats } from '../types';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.endsWith('/api/v1')
    ? rawApiUrl
    : `${rawApiUrl}/api/v1`
  : '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly refresh cookies
});

// Access token variable stored in memory
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

// Request interceptor to attach Authorization header
api.interceptors.request.use((config) => {
  if (inMemoryAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// Response interceptor to handle transparent 401 token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/google')
    ) {
      originalRequest._retry = true;

      try {
        const refreshRes = await axios.post<{ accessToken: string; user: User }>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshRes.data.accessToken;
        setAccessToken(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        setAccessToken(null);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Typed API Functions
export const ApiService = {
  // Auth
  firebaseAuth: (idToken: string) =>
    api.post<{ user: User; accessToken: string }>('/auth/firebase', { idToken }),
  googleAuth: (idToken: string) =>
    api.post<{ user: User; accessToken: string }>('/auth/google', { idToken }),
  refreshToken: () =>
    api.post<{ user: User; accessToken: string }>('/auth/refresh'),
  logout: () => api.post('/auth/logout'),

  // User Profile & Stats
  getMe: () => api.get<User>('/me'),
  getStats: () => api.get<UserStats>('/me/stats'),
  getMyFiles: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ files: FileMetadata[]; pagination: any }>('/me/files', { params }),

  // Uploads
  initUpload: (data: {
    nameEnc: string;
    mimeEnc: string;
    size: number;
    chunkCount: number;
    chunkSize: number;
    pwVerifier?: string;
    pwSalt?: string;
    kdfParams?: any;
    expiresInSeconds?: number;
    maxDownloads?: number;
  }) =>
    api.post<{ uploadId: string; fileId: string; code: string; expiresAt: string }>(
      '/uploads',
      data
    ),

  uploadChunk: (
    uploadId: string,
    chunkIdx: number,
    formData: FormData,
    headers: {
      'Idempotency-Key': string;
      'X-Chunk-IV': string;
      'X-Chunk-SHA256': string;
      'X-Chunk-Size': string;
    },
    onUploadProgress?: (progressEvent: any) => void
  ) =>
    api.put(`/uploads/${uploadId}/chunks/${chunkIdx}`, formData, {
      headers,
      onUploadProgress,
      timeout: 180000,
    }),

  completeUpload: (uploadId: string) =>
    api.post<{ code: string; shareUrl: string; fileId: string }>(
      `/uploads/${uploadId}/complete`
    ),

  // File Operations & Download
  getFileMetadata: (code: string) => api.get<FileMetadata>(`/files/${code}`),

  unlockFile: (code: string, password: string) =>
    api.post<{ downloadToken: string; expiresIn: number }>(`/files/${code}/unlock`, { password }),

  downloadChunkStream: (
    code: string,
    chunkIdx: number,
    downloadToken?: string,
    onProgress?: (receivedBytes: number) => void
  ) =>
    api.get(`/files/${code}/chunks/${chunkIdx}`, {
      responseType: 'arraybuffer',
      headers: downloadToken ? { 'X-Download-Token': downloadToken } : {},
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.loaded) {
          onProgress(progressEvent.loaded);
        }
      },
    }),

  updateFile: (fileId: string, data: Partial<FileMetadata>) =>
    api.patch(`/files/${fileId}`, data),

  regenerateCode: (fileId: string) =>
    api.post<{ id: string; code: string }>(`/files/${fileId}/regenerate-code`),

  moveToTrash: (fileId: string) => api.delete(`/files/${fileId}`),

  restoreFile: (fileId: string) => api.post(`/files/${fileId}/restore`),

  permanentDelete: (fileId: string) => api.delete(`/files/${fileId}/permanent`),

  reportFile: (code: string, reason: string) =>
    api.post(`/files/${code}/report`, { reason }),
};
