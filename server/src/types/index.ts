import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface DownloadTokenPayload {
  fileId: string;
  code: string;
  unlocked: boolean;
  exp: number;
}

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; title?: string };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface AppErrorDetails {
  [key: string]: any;
}
