import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { ApiService } from '../services/api.ts';
import { ClientCryptoService } from '../services/crypto.client.ts';
import { DownloadEngine } from '../services/download.engine.ts';
import { FileMetadata } from '../types/index.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Progress } from '../components/ui/Progress.tsx';
import { Card } from '../components/ui/Card.tsx';
import {
  Download,
  Lock,
  KeyRound,
  FileIcon,
  ShieldAlert,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  User,
  Flag,
} from 'lucide-react';

export const DownloadPage = () => {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();

  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [fileName, setFileName] = useState<string>('Loading file...');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Decryption credentials
  const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
  const [manualKey, setManualKey] = useState<string>('');
  const [password, setPassword] = useState('');
  const [downloadToken, setDownloadToken] = useState<string | undefined>(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [downloadEta, setDownloadEta] = useState(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Abuse reporting
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Extract #k=... from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/#k=([a-fA-F0-9]+)/);
    if (match && match[1]) {
      setKeyHex(match[1]);
    }
  }, [location]);

  // Fetch file metadata
  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);

    ApiService.getFileMetadata(code)
      .then(async (res) => {
        const meta = res.data;
        setMetadata(meta);

        // Set original filename
        if (keyHex && meta.nameEnc.includes('=')) {
          const decryptedName = await ClientCryptoService.decryptString(meta.nameEnc, keyHex);
          setFileName(decryptedName);
        } else {
          setFileName(meta.nameEnc || 'downloaded_file');
        }
      })
      .catch((err) => {
        const errCode = err.response?.data?.error?.code;
        const errMsg = err.response?.data?.error?.message;
        if (errCode === 'FILE_EXPIRED') {
          setError('This file link has expired and is no longer accessible.');
        } else if (errCode === 'DOWNLOAD_LIMIT_REACHED') {
          setError('This file has reached its maximum download limit.');
        } else {
          setError(errMsg || 'File not found or has been deleted.');
        }
      })
      .finally(() => setLoading(false));
  }, [code, keyHex]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password.trim()) return;

    setUnlocking(true);
    setUnlockError(null);

    try {
      const res = await ApiService.unlockFile(code, password);
      setDownloadToken(res.data.downloadToken);

      // Decrypt filename
      setFileName(metadata?.nameEnc || 'unlocked_file');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Incorrect password';
      setUnlockError(msg);
    } finally {
      setUnlocking(false);
    }
  };

  const handleManualKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = manualKey.trim();
    if (cleaned.includes('#k=')) {
      cleaned = cleaned.split('#k=')[1];
    }
    cleaned = cleaned.replace(/[^a-fA-F0-9]/g, '');

    if (cleaned.length === 64) {
      setKeyHex(cleaned);
      if (metadata) {
        const decryptedName = await ClientCryptoService.decryptString(metadata.nameEnc, cleaned);
        setFileName(decryptedName);
      }
    } else {
      alert('Please enter a valid 64-character hex decryption key or paste the full share link.');
    }
  };

  const handleStartDownload = () => {
    if (!metadata) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const engine = new DownloadEngine(
      metadata,
      {
        keyHex,
        password: password || undefined,
        downloadToken,
      },
      {
        onProgress: (progress, speed, eta) => {
          setDownloadProgress(progress);
          setDownloadSpeed(speed);
          setDownloadEta(eta);
        },
        onChunkComplete: () => {},
        onError: (err) => {
          alert('Download error: ' + err);
          setIsDownloading(false);
        },
        onSuccess: () => {
          setIsDownloading(false);
          setDownloadSuccess(true);
        },
      }
    );

    engine.start();
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !reportReason.trim()) return;

    try {
      await ApiService.reportFile(code, reportReason);
      setReportSuccess(true);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err: any) {
      alert('Failed to submit report: ' + err.message);
    }
  };

  const formatSize = (bytesStr: string): string => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
          <Download className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-sm text-slate-400">Verifying code and chunk integrity...</p>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <Card className="max-w-md w-full text-center space-y-4 p-8">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Unable to Access File</h2>
          <p className="text-sm text-slate-400">{error || 'This file is no longer available.'}</p>
          <Link to="/" className="inline-block mt-4">
            <Button variant="outline">Return Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const needsPassword = metadata.passwordRequired && !downloadToken;
  const needsLinkKey = !metadata.passwordRequired && !keyHex && metadata.nameEnc.includes('=');

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 sm:px-6 py-12 max-w-xl mx-auto w-full">
      <Card className="w-full space-y-6 p-6 sm:p-8">
        {/* File Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <FileIcon className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="overflow-hidden flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 truncate" title={fileName}>
              {fileName}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>{formatSize(metadata.size)}</span>
              <span>•</span>
              <span>{metadata.chunkCount} {metadata.chunkCount === 1 ? 'Chunk' : 'Chunks'}</span>
              <span>•</span>
              <span className="font-mono text-indigo-400 font-semibold">{metadata.code}</span>
            </p>
          </div>
        </div>

        {/* Security & Uploader Info Badges */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="truncate">Sent by {metadata.uploaderName || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="truncate">
              {metadata.expiresAt
                ? `Expires ${new Date(metadata.expiresAt).toLocaleDateString()}`
                : 'Never expires'}
            </span>
          </div>
        </div>

        {metadata.maxDownloads && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            <Flame className="w-4 h-4" />
            <span>
              Burn after reading: {metadata.downloadCount} / {metadata.maxDownloads} downloads used
            </span>
          </div>
        )}

        {/* Password Prompt */}
        {needsPassword ? (
          <form onSubmit={handleUnlock} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" /> This file requires a password
              </label>
              <Input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={unlockError || undefined}
                icon={<KeyRound className="w-4 h-4" />}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" isLoading={unlocking}>
              Unlock File
            </Button>
          </form>
        ) : needsLinkKey ? (
          /* Missing Link Key Prompt */
          <form onSubmit={handleManualKeySubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Zero-Knowledge Decryption Key
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                This file was encrypted in the sender's browser without a password. Paste the complete share link (which includes <code className="text-indigo-300">#k=...</code>) or paste the 64-character hex key:
              </p>
              <Input
                type="text"
                placeholder="Paste full link (https://...#k=...) or 64-char key..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                icon={<KeyRound className="w-4 h-4" />}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Unlock & Decrypt
            </Button>
          </form>
        ) : (
          /* Download & Decrypt Section */
          <div className="space-y-4 pt-2">
            {isDownloading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Streaming & Decrypting...</span>
                  <span className="font-mono text-indigo-400 font-bold">{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatSpeed(downloadSpeed)}</span>
                  <span>{downloadEta > 0 ? `${downloadEta}s remaining` : 'Finalizing...'}</span>
                </div>
              </div>
            ) : downloadSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>File downloaded and verified successfully! Check your downloads.</span>
              </div>
            ) : (
              <Button size="lg" className="w-full text-base font-bold" onClick={handleStartDownload}>
                <Download className="w-5 h-5 mr-2" /> Decrypt & Save File
              </Button>
            )}

            <p className="text-[11px] text-center text-slate-500">
              Zero-knowledge guarantee: chunks are fetched from the secure cloud vault and decrypted on-the-fly inside your browser.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-300 transition-colors">
            Send your own files
          </Link>
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-1 hover:text-rose-400 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" /> Report abuse
          </button>
        </div>
      </Card>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setReportModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Report File
            </h3>
            {reportSuccess ? (
              <p className="text-xs text-emerald-400">Report received. Thank you.</p>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-3">
                <textarea
                  required
                  placeholder="Explain why this file violates policies (e.g. malware, abuse)..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setReportModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" type="submit">
                    Submit Report
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
