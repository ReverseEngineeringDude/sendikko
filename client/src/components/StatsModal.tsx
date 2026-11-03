import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import { Progress } from './ui/Progress.tsx';
import { ApiService } from '../services/api.ts';
import { UserStats, User } from '../types/index.ts';
import { HardDrive, Download, FileText, Trash2, ShieldCheck } from 'lucide-react';

export interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const StatsModal = ({ isOpen, onClose, user }: StatsModalProps) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      ApiService.getStats()
        .then((res) => setStats(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const quotaBytes = user ? BigInt(user.quotaBytes) : BigInt(10737418240);
  const usedBytes = stats ? BigInt(stats.totalUsedBytes) : BigInt(0);
  const percentage = Number((usedBytes * BigInt(100)) / quotaBytes);

  const formatSize = (bytes: bigint | number): string => {
    const b = Number(bytes);
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Storage & Vault Analytics"
      description="Aggregated usage of your encrypted cloud vault"
      maxWidth="md"
    >
      <div className="flex flex-col gap-6 pt-2">
        {/* Storage Bar Card */}
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-300">
              <HardDrive className="w-4 h-4 text-indigo-400" /> Storage Used
            </span>
            <span className="font-mono text-xs text-slate-400">
              {formatSize(usedBytes)} / {formatSize(quotaBytes)} ({percentage}%)
            </span>
          </div>

          <Progress value={percentage} />

          <p className="text-[11px] text-slate-500">
            Files are stored in encrypted chunks across high-durability cloud storage.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center">
            <FileText className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-slate-100">{stats?.activeFiles || 0}</p>
            <p className="text-xs text-slate-400">Active Files</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center">
            <Download className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-slate-100">{stats?.totalDownloads || 0}</p>
            <p className="text-xs text-slate-400">Total Downloads</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center col-span-2 sm:col-span-1">
            <Trash2 className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-slate-100">{stats?.trashedFiles || 0}</p>
            <p className="text-xs text-slate-400">In Trash</p>
          </div>
        </div>

        <Button className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
};
