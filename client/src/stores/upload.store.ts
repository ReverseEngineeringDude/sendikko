import { create } from 'zustand';
import { FileItem } from '../types/index.ts';
import { UploadEngine } from '../services/upload.engine.ts';

interface UploadState {
  queue: FileItem[];
  activeUploadEngines: Map<string, UploadEngine>;
  isUploadModalOpen: boolean;
  completedFile: FileItem | null;
  isResultModalOpen: boolean;

  openUploadModal: () => void;
  closeUploadModal: () => void;
  openResultModal: (file: FileItem) => void;
  closeResultModal: () => void;

  enqueueFiles: (
    files: File[],
    options: { password?: string; expiresInSeconds?: number; maxDownloads?: number }
  ) => void;
  startUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  removeFile: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  queue: [],
  activeUploadEngines: new Map(),
  isUploadModalOpen: false,
  completedFile: null,
  isResultModalOpen: false,

  openUploadModal: () => set({ isUploadModalOpen: true }),
  closeUploadModal: () => set({ isUploadModalOpen: false }),
  openResultModal: (file: FileItem) =>
    set({ completedFile: file, isResultModalOpen: true }),
  closeResultModal: () => set({ isResultModalOpen: false, completedFile: null }),

  enqueueFiles: (files, options) => {
    const newItems: FileItem[] = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      name: file.name,
      size: file.size,
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      speed: 0,
      eta: 0,
      options,
    }));

    set((state) => ({
      queue: [...state.queue, ...newItems],
      isUploadModalOpen: true,
    }));

    // Auto-start each enqueued item
    newItems.forEach((item) => {
      get().startUpload(item.id);
    });
  },

  startUpload: (id: string) => {
    const item = get().queue.find((q) => q.id === id);
    if (!item || item.status === 'uploading') return;

    set((state) => ({
      queue: state.queue.map((q) =>
        q.id === id ? { ...q, status: 'uploading', error: undefined } : q
      ),
    }));

    const engine = new UploadEngine(item, {
      onProgress: (progress, speed, eta) => {
        set((state) => ({
          queue: state.queue.map((q) =>
            q.id === id ? { ...q, progress, speed, eta } : q
          ),
        }));
      },
      onChunkComplete: (_chunkIdx, _totalChunks) => {},
      onError: (error) => {
        set((state) => ({
          queue: state.queue.map((q) =>
            q.id === id ? { ...q, status: 'error', error } : q
          ),
        }));
        get().activeUploadEngines.delete(id);
      },
      onSuccess: ({ code, shareUrl, keyHex }) => {
        const updatedQueue = get().queue.map((q) =>
          q.id === id
            ? {
                ...q,
                status: 'completed' as const,
                progress: 100,
                code,
                shareUrl,
                keyHex,
              }
            : q
        );
        const finishedItem = updatedQueue.find((q) => q.id === id);
        set({ queue: updatedQueue });
        get().activeUploadEngines.delete(id);

        if (finishedItem) {
          get().openResultModal(finishedItem);
        }
      },
    });

    get().activeUploadEngines.set(id, engine);
    engine.start();
  },

  pauseUpload: (id: string) => {
    const engine = get().activeUploadEngines.get(id);
    if (engine) {
      engine.pause();
      set((state) => ({
        queue: state.queue.map((q) =>
          q.id === id ? { ...q, status: 'paused' } : q
        ),
      }));
    }
  },

  resumeUpload: (id: string) => {
    const engine = get().activeUploadEngines.get(id);
    if (engine) {
      engine.resume();
      set((state) => ({
        queue: state.queue.map((q) =>
          q.id === id ? { ...q, status: 'uploading' } : q
        ),
      }));
    } else {
      get().startUpload(id);
    }
  },

  cancelUpload: (id: string) => {
    const engine = get().activeUploadEngines.get(id);
    if (engine) {
      engine.cancel();
      get().activeUploadEngines.delete(id);
    }
    set((state) => ({
      queue: state.queue.filter((q) => q.id !== id),
    }));
  },

  removeFile: (id: string) => {
    get().cancelUpload(id);
  },

  clearCompleted: () => {
    set((state) => ({
      queue: state.queue.filter((q) => q.status !== 'completed'),
    }));
  },
}));
