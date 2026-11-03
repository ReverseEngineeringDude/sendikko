import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import { ApiService } from '../services/api.ts';
import { FileMetadata } from '../types/index.ts';
import { RotateCcw, Trash2, AlertTriangle, FileIcon } from 'lucide-react';

export interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent: () => void;
}

export const TrashModal = ({ isOpen, onClose, onRefreshParent }: TrashModalProps) => {
  const [trashedFiles, setTrashedFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getMyFiles({ status: 'trashed' });
      setTrashedFiles(res.data.files);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
    }
  }, [isOpen]);

  const handleRestore = async (id: string) => {
    try {
      await ApiService.restoreFile(id);
      fetchTrash();
      onRefreshParent();
    } catch (err: any) {
      alert('Failed to restore file: ' + err.message);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('Permanently delete this file and all its chunks from storage? This cannot be undone.')) {
      return;
    }
    try {
      await ApiService.permanentDelete(id);
      fetchTrash();
      onRefreshParent();
    } catch (err: any) {
      alert('Failed to delete file permanently: ' + err.message);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Trash & Deleted Files"
      description="Items are automatically purged from the vault after 7 days"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1 pt-2">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading trash...</div>
        ) : trashedFiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <Trash2 className="w-8 h-8 text-slate-600" />
            <span>Trash is empty</span>
          </div>
        ) : (
          trashedFiles.map((file) => (
            <div
              key={file.id}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                  <FileIcon className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate">{file.nameEnc}</p>
                  <p className="text-xs text-slate-500">
                    Code: {file.code} • {(Number(file.size) / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => file.id && handleRestore(file.id)}
                  title="Restore File"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Restore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => file.id && handlePermanentDelete(file.id)}
                  title="Purge Now"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Purge
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
};
