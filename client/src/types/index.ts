export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  quotaBytes: string;
  usedBytes?: string;
}

export interface FileMetadata {
  id?: string;
  code: string;
  nameEnc: string;
  mimeEnc: string;
  size: string;
  chunkCount: number;
  chunkSize: number;
  passwordRequired: boolean;
  pwSalt?: string;
  kdfParams?: {
    algorithm: string;
    iterations: number;
    hash?: string;
  };
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  uploaderName?: string;
  status?: string;
  createdAt?: string;
  deletedAt?: string | null;
  chunks?: Array<{
    idx: number;
    iv: string;
    sha256: string;
    size: number;
  }>;
}

export interface FileItem {
  id: string; // unique internal tracking id
  file: File;
  name: string;
  size: number;
  status: 'idle' | 'encrypting' | 'uploading' | 'paused' | 'completed' | 'error';
  progress: number; // 0 to 100
  uploadedBytes: number;
  speed: number; // bytes/sec
  eta: number; // seconds
  error?: string;
  uploadId?: string;
  code?: string;
  shareUrl?: string;
  keyHex?: string; // Random 256-bit AES key if no password
  options: {
    password?: string;
    expiresInSeconds?: number;
    maxDownloads?: number;
  };
}

export interface UserStats {
  totalUsedBytes: string;
  activeFiles: number;
  trashedFiles: number;
  expiredFiles: number;
  totalDownloads: number;
}
