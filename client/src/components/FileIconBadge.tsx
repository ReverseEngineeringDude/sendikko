import {
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Package,
  Archive,
  FileCode,
  File,
  Radio,
} from 'lucide-react';

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'apk'
  | 'archive'
  | 'code'
  | 'other';

export interface FileTypeInfo {
  category: FileCategory;
  extension: string;
  isLive: boolean;
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  IconComponent: any;
}

export function getFileTypeInfo(fileName: string): FileTypeInfo {
  const isLive =
    fileName.toLowerCase().includes('live_') ||
    fileName.includes('[LIVE]') ||
    fileName.toLowerCase().startsWith('live-');

  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'].includes(ext)) {
    return {
      category: 'image',
      extension: ext.toUpperCase(),
      isLive,
      label: 'IMAGE',
      badgeClass: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
      bgClass: 'bg-pink-500/10',
      textClass: 'text-pink-400',
      borderClass: 'border-pink-500/30',
      IconComponent: ImageIcon,
    };
  }

  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'm4v', '3gp'].includes(ext)) {
    return {
      category: 'video',
      extension: ext.toUpperCase(),
      isLive,
      label: 'VIDEO',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
      bgClass: 'bg-rose-500/10',
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500/30',
      IconComponent: Film,
    };
  }

  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) {
    return {
      category: 'audio',
      extension: ext.toUpperCase(),
      isLive,
      label: 'AUDIO',
      badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
      bgClass: 'bg-violet-500/10',
      textClass: 'text-violet-400',
      borderClass: 'border-violet-500/30',
      IconComponent: Music,
    };
  }

  if (['apk', 'aab', 'xapk', 'ipa'].includes(ext)) {
    return {
      category: 'apk',
      extension: ext.toUpperCase(),
      isLive,
      label: 'APP / APK',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
      bgClass: 'bg-emerald-500/10',
      textClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/30',
      IconComponent: Package,
    };
  }

  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md'].includes(ext)) {
    return {
      category: 'document',
      extension: ext.toUpperCase(),
      isLive,
      label: 'DOCUMENT',
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
      bgClass: 'bg-blue-500/10',
      textClass: 'text-blue-400',
      borderClass: 'border-blue-500/30',
      IconComponent: FileText,
    };
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return {
      category: 'archive',
      extension: ext.toUpperCase(),
      isLive,
      label: 'ARCHIVE',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
      bgClass: 'bg-amber-500/10',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500/30',
      IconComponent: Archive,
    };
  }

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'cpp', 'c', 'java', 'go', 'rs', 'sql', 'sh'].includes(ext)) {
    return {
      category: 'code',
      extension: ext.toUpperCase(),
      isLive,
      label: 'CODE',
      badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
      bgClass: 'bg-cyan-500/10',
      textClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/30',
      IconComponent: FileCode,
    };
  }

  return {
    category: 'other',
    extension: ext ? ext.toUpperCase() : 'FILE',
    isLive,
    label: ext ? ext.toUpperCase() : 'FILE',
    badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-700',
    bgClass: 'bg-slate-800/40',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-700',
    IconComponent: File,
  };
}

export const LiveBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/20 animate-pulse">
    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
    <Radio className="w-3 h-3 text-rose-400" />
    LIVE
  </span>
);
