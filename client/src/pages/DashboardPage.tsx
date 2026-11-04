import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/auth.store.ts';
import { ApiService, API_BASE_URL } from '../services/api.ts';
import { FileMetadata } from '../types/index.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { QRCodeModal } from '../components/QRCodeModal.tsx';
import { StatsModal } from '../components/StatsModal.tsx';
import { TrashModal } from '../components/TrashModal.tsx';
import { LiveCaptureModal } from '../components/LiveCaptureModal.tsx';
import {
  getFileTypeInfo,
  LiveBadge,
  FileCategory,
} from '../components/FileIconBadge.tsx';
import {
  Search,
  LayoutGrid,
  List,
  Copy,
  Check,
  QrCode,
  Trash2,
  RefreshCw,
  HardDrive,
  Download,
  Lock,
  FileIcon,
  Edit2,
  Radio,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Film,
  Music,
  Package,
  FileText,
  Archive,
  Code,
  FolderOpen,
} from 'lucide-react';

interface ImageThumbnailProps {
  code: string;
  alt: string;
  isLive: boolean;
}

const ImageThumbnail = ({ code, alt, isLive }: ImageThumbnailProps) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="w-full h-36 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center justify-center text-slate-500 gap-1.5">
        <ImageIcon className="w-7 h-7 opacity-50 text-pink-400" />
        <span className="text-[11px] font-mono">Image Preview</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800/80 group">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 animate-pulse">
          <ImageIcon className="w-6 h-6 text-pink-400/60" />
        </div>
      )}
      <img
        src={`${API_BASE_URL}/files/${code}/preview`}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {isLive && (
        <div className="absolute top-2.5 left-2.5 z-10 drop-shadow-md">
          <LiveBadge />
        </div>
      )}
      <a
        href={`/d/${code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[2px]"
      >
        <ExternalLink className="w-4 h-4 text-pink-400" /> View Original
      </a>
    </div>
  );
};

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FileCategory | 'live'>('all');

  // Modals state
  const [qrModal, setQrModal] = useState<{ isOpen: boolean; url: string; code: string }>({
    isOpen: false,
    url: '',
    code: '',
  });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [liveCaptureOpen, setLiveCaptureOpen] = useState(false);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getMyFiles({
        status: 'active',
        search: search.trim() || undefined,
      });
      setFiles(res.data.files);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [search]);

  const handleCopyLink = async (file: FileMetadata) => {
    const url = `${window.location.origin}/d/${file.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(file.code);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert(url);
    }
  };

  const handleRegenerateCode = async (fileId?: string) => {
    if (!fileId) return;
    if (!confirm('Regenerate code? The previous 8-character code and share link will immediately stop working.')) {
      return;
    }
    try {
      await ApiService.regenerateCode(fileId);
      fetchFiles();
    } catch (err: any) {
      alert('Failed to regenerate code: ' + err.message);
    }
  };

  const handleSoftDelete = async (fileId?: string) => {
    if (!fileId) return;
    if (!confirm('Move file to trash? It can be restored within 7 days before permanent purge.')) {
      return;
    }
    try {
      await ApiService.moveToTrash(fileId);
      fetchFiles();
    } catch (err: any) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const handleRename = async (file: FileMetadata) => {
    if (!file.id) return;
    const newName = prompt('Enter new display name for this file:', file.nameEnc);
    if (!newName || newName === file.nameEnc) return;

    try {
      await ApiService.updateFile(file.id, { nameEnc: newName });
      fetchFiles();
    } catch (err: any) {
      alert('Failed to update file: ' + err.message);
    }
  };

  const formatSize = (bytesStr: string): string => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Filter files by category / live status
  const filteredFiles = files.filter((file) => {
    const info = getFileTypeInfo(file.nameEnc);
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'live') return info.isLive;
    return info.category === categoryFilter;
  });

  // Calculate counts for categories
  const counts = {
    all: files.length,
    image: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'image').length,
    video: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'video').length,
    audio: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'audio').length,
    apk: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'apk').length,
    document: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'document').length,
    archive: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'archive').length,
    code: files.filter((f) => getFileTypeInfo(f.nameEnc).category === 'code').length,
    live: files.filter((f) => getFileTypeInfo(f.nameEnc).isLive).length,
  };

  const filterTabs = [
    { key: 'all' as const, label: 'All Files', icon: Layers, count: counts.all },
    { key: 'live' as const, label: 'Live Media', icon: Radio, count: counts.live, isLive: true },
    { key: 'image' as const, label: 'Images', icon: ImageIcon, count: counts.image },
    { key: 'video' as const, label: 'Videos', icon: Film, count: counts.video },
    { key: 'audio' as const, label: 'Audio', icon: Music, count: counts.audio },
    { key: 'apk' as const, label: 'APKs & Apps', icon: Package, count: counts.apk },
    { key: 'document' as const, label: 'Docs', icon: FileText, count: counts.document },
    { key: 'archive' as const, label: 'Archives', icon: Archive, count: counts.archive },
    { key: 'code' as const, label: 'Code', icon: Code, count: counts.code },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar: Title, Live Take & Actions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              My Files & Vault
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Secure client-encrypted files & live media stored in your private vault
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Live Take Button */}
          <Button
            onClick={() => setLiveCaptureOpen(true)}
            className="flex-1 sm:flex-none bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold shadow-lg shadow-rose-500/20 border border-rose-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            size="sm"
          >
            <Radio className="w-4 h-4 mr-2 animate-pulse text-white" />
            Live Take
          </Button>

          <Button variant="outline" size="sm" onClick={() => setStatsModalOpen(true)}>
            <HardDrive className="w-4 h-4 mr-1.5 text-indigo-400" /> Stats
          </Button>

          <Button variant="outline" size="sm" onClick={() => setTrashModalOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1.5 text-rose-400" /> Trash
          </Button>
        </div>
      </motion.div>

      {/* Category Tabs: Horizontally scrollable on mobile */}
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 pb-1 min-w-max">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = categoryFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCategoryFilter(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 border border-indigo-500'
                    : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    tab.isLive ? 'text-rose-400' : isActive ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Search by file name or 8-char code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-mono">
            Showing {filteredFiles.length} of {files.length}
          </span>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* File List / Grid with Framer Motion animations */}
      {loading ? (
        <div className="py-24 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-indigo-500" />
          <span className="font-medium">Loading your encrypted vault...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="text-center py-20 px-4 space-y-4 border-dashed border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">No files found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                {search
                  ? `No matches for "${search}" in this category.`
                  : categoryFilter !== 'all'
                  ? `No files categorized under ${categoryFilter}.`
                  : 'Upload your first file or capture live media to store in your private vault.'}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLiveCaptureOpen(true)}
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                <Radio className="w-4 h-4 mr-2 animate-pulse text-rose-400" />
                Live Capture
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.04 },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filteredFiles.map((file) => {
            const info = getFileTypeInfo(file.nameEnc);
            const Icon = info.IconComponent;

            return (
              <motion.div
                key={file.id}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4 flex flex-col justify-between h-full gap-3 hover:border-slate-700/80 transition-all hover:shadow-xl hover:shadow-indigo-500/5 group bg-slate-900/60 backdrop-blur-md">
                  <div className="space-y-3">
                    {/* If Image, show image preview */}
                    {info.category === 'image' ? (
                      <ImageThumbnail
                        code={file.code}
                        alt={file.nameEnc}
                        isLive={info.isLive}
                      />
                    ) : (
                      /* Header for Non-Image Files */
                      <div className="flex items-center justify-between gap-2">
                        <div className={`p-2.5 rounded-xl ${info.bgClass} ${info.textClass} flex-shrink-0 border ${info.borderClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {info.isLive && <LiveBadge />}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${info.badgeClass}`}>
                            {info.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* File Title and Info */}
                    <div>
                      {info.category === 'image' && (
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${info.badgeClass}`}>
                            {info.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatSize(file.size)}
                          </span>
                        </div>
                      )}

                      <h4
                        className="text-sm font-bold text-slate-100 truncate group-hover:text-indigo-300 transition-colors"
                        title={file.nameEnc}
                      >
                        {file.nameEnc}
                      </h4>

                      {info.category !== 'image' && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {formatSize(file.size)} • {file.chunkCount} {file.chunkCount === 1 ? 'chunk' : 'chunks'}
                        </p>
                      )}
                    </div>

                    {/* Code & Security Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="default" className="font-mono text-xs">
                        {file.code}
                      </Badge>
                      {file.passwordRequired && (
                        <Badge variant="warning">
                          <Lock className="w-3 h-3 mr-1" /> Protected
                        </Badge>
                      )}
                      {file.maxDownloads && (
                        <Badge variant="outline">
                          {file.downloadCount}/{file.maxDownloads} DL
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Toolbar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1 font-mono" title="Total downloads">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{file.downloadCount}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(file)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        title="Copy Share Link"
                      >
                        {copiedId === file.code ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setQrModal({
                            isOpen: true,
                            url: `${window.location.origin}/d/${file.code}`,
                            code: file.code,
                          })
                        }
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        title="View QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <a
                        href={`/d/${file.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                        title="Open Download Page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {(file.mimeEnc?.startsWith('video') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.nameEnc)) && (
                        <a
                          href={`/v/${file.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-orange-400 transition-colors"
                          title="Stream Video / Reddit Player"
                        >
                          <Film className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleRename(file)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        title="Rename File"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRegenerateCode(file.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                        title="Regenerate 8-Char Code"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(file.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-rose-400 transition-colors"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        /* List View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden backdrop-blur-md"
        >
          <div className="divide-y divide-slate-800">
            {filteredFiles.map((file) => {
              const info = getFileTypeInfo(file.nameEnc);
              const Icon = info.IconComponent;

              return (
                <div
                  key={file.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Thumbnail or Category Icon */}
                    {info.category === 'image' ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 relative group">
                        <img
                          src={`${API_BASE_URL}/files/${file.code}/preview`}
                          alt={file.nameEnc}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl ${info.bgClass} ${info.textClass} flex items-center justify-center flex-shrink-0 border ${info.borderClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    )}

                    <div className="overflow-hidden min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100 truncate" title={file.nameEnc}>
                          {file.nameEnc}
                        </p>
                        {info.isLive && <LiveBadge />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-mono">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span>Code: <span className="text-indigo-400 font-bold">{file.code}</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Download className="w-3 h-3" /> {file.downloadCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex items-center justify-end gap-1 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <button
                      onClick={() => handleCopyLink(file)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                      title="Copy Link"
                    >
                      {copiedId === file.code ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setQrModal({
                          isOpen: true,
                          url: `${window.location.origin}/d/${file.code}`,
                          code: file.code,
                        })
                      }
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                      title="QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <a
                      href={`/d/${file.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                      title="Open Download Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {(file.mimeEnc?.startsWith('video') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.nameEnc)) && (
                      <a
                        href={`/v/${file.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-orange-400 hover:bg-slate-800 transition-colors"
                        title="Stream Video / Reddit Player"
                      >
                        <Film className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleRename(file)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                      title="Rename"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSoftDelete(file.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Live Capture Modal */}
      <LiveCaptureModal
        isOpen={liveCaptureOpen}
        onClose={() => {
          setLiveCaptureOpen(false);
          fetchFiles();
        }}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={qrModal.isOpen}
        onClose={() => setQrModal({ isOpen: false, url: '', code: '' })}
        url={qrModal.url}
        code={qrModal.code}
      />

      {/* Stats Modal */}
      <StatsModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        user={user}
      />

      {/* Trash Modal */}
      <TrashModal
        isOpen={trashModalOpen}
        onClose={() => setTrashModalOpen(false)}
        onRefreshParent={fetchFiles}
      />
    </div>
  );
};
