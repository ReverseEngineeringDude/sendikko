import { useUploadStore } from '../stores/upload.store.ts';
import { Dialog } from './ui/Dialog.tsx';
import { Progress } from './ui/Progress.tsx';
import { Button } from './ui/Button.tsx';
import { Play, Pause, X, CheckCircle2, AlertCircle, FileIcon } from 'lucide-react';

export const UploadModal = () => {
  const {
    queue,
    isUploadModalOpen,
    closeUploadModal,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearCompleted,
  } = useUploadStore();

  if (queue.length === 0) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatEta = (seconds: number): string => {
    if (seconds <= 0) return 'Finishing...';
    if (seconds < 60) return `${seconds}s remaining`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s remaining`;
  };

  return (
    <Dialog
      isOpen={isUploadModalOpen}
      onClose={closeUploadModal}
      title="Upload Queue"
      description="Zero-knowledge AES-256 chunk streaming to secure vault"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
        {queue.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatSize(item.size)} • {item.options.password ? 'Password Protected' : 'Key in URL'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.status === 'uploading' && (
                  <button
                    onClick={() => pauseUpload(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}
                {item.status === 'paused' && (
                  <button
                    onClick={() => resumeUpload(item.id)}
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800"
                    title="Resume"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => cancelUpload(item.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={item.progress} />

            {/* Meta status & Speed */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                {item.status === 'completed' && (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded & Encrypted
                  </span>
                )}
                {item.status === 'uploading' && (
                  <span>
                    {item.progress}% • {formatSpeed(item.speed)} • {formatEta(item.eta)}
                  </span>
                )}
                {item.status === 'paused' && (
                  <span className="text-amber-400 font-medium">Paused</span>
                )}
                {item.status === 'error' && (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {item.error || 'Failed'}
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-500">{item.progress}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={clearCompleted}>
          Clear Completed
        </Button>
        <Button size="sm" onClick={closeUploadModal}>
          Minimize
        </Button>
      </div>
    </Dialog>
  );
};
