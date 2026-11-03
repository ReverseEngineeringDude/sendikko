import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Inbox, Shield } from 'lucide-react';

export const RequestFilesPage = () => {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 sm:px-6 py-12 max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
          <Inbox className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">Sendikko File Request</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          You have been invited to securely upload files into this user's private encrypted vault.
        </p>
      </div>

      <Dropzone />

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Shield className="w-4 h-4 text-emerald-400" />
        <span>End-to-end encrypted: chunks are encrypted client-side prior to transfer.</span>
      </div>
    </div>
  );
};
