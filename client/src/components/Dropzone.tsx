import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '../stores/upload.store.ts';
import { useAuthStore } from '../stores/auth.store.ts';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';
import {
  UploadCloud,
  Lock,
  Clock,
  Flame,
  KeyRound,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const Dropzone = () => {
  const { enqueueFiles } = useUploadStore();
  const { isAuthenticated } = useAuthStore();

  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<number>(86400 * 7); // 7 days default
  const [maxDownloads, setMaxDownloads] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      if (!isAuthenticated) {
        alert('Please sign in with Google to upload files to your secure cloud vault.');
        return;
      }

      enqueueFiles(acceptedFiles, {
        password: password.trim() || undefined,
        expiresInSeconds: expiry > 0 ? expiry : undefined,
        maxDownloads: maxDownloads && maxDownloads > 0 ? maxDownloads : undefined,
      });

      // Reset password after enqueuing
      setPassword('');
    },
    [enqueueFiles, isAuthenticated, password, expiry, maxDownloads]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
  });

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Drop Zone Box */}
      <div
        {...getRootProps()}
        className={`relative group cursor-pointer rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 backdrop-blur-xl ${
          isDragActive
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-slate-900/60'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UploadCloud className="w-10 h-10 text-indigo-400 group-hover:text-pink-400 transition-colors" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-100">
              {isDragActive ? 'Drop your files now' : 'Drag & drop files here'}
            </h3>
            <p className="text-sm text-slate-400">
              or <span className="text-indigo-400 font-semibold underline">browse from your device</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
              <Lock className="w-3 h-3 text-emerald-400" /> Client Encrypted
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
              <FileCheck className="w-3 h-3 text-indigo-400" /> Any File Type
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
              <Flame className="w-3 h-3 text-amber-400" /> 19 MB Smart Chunks
            </span>
          </div>
        </div>
      </div>

      {/* Security & Expiry Options Panel */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            Security & Expiry Settings
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Optional Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Password Protection
              </label>
              <Input
                type="password"
                placeholder="Leave blank for link key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs py-2"
              />
            </div>

            {/* Expiry Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Expiry Duration
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value={3600}>1 Hour</option>
                <option value={86400}>1 Day (24h)</option>
                <option value={604800}>7 Days</option>
                <option value={2592000}>30 Days</option>
                <option value={0}>Never Expire</option>
              </select>
            </div>

            {/* Download Limit / Burn After Reading */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" /> Download Limit
              </label>
              <select
                value={maxDownloads ?? ''}
                onChange={(e) =>
                  setMaxDownloads(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Unlimited Downloads</option>
                <option value="1">Burn After 1 Download</option>
                <option value="3">Max 3 Downloads</option>
                <option value="5">Max 5 Downloads</option>
                <option value="10">Max 10 Downloads</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
