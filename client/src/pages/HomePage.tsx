import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import {
  Download,
  Shield,
  Zap,
  Lock,
  Layers,
  Key,
  HardDrive,
  EyeOff,
  Flame,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export const HomePage = () => {
  const [downloadCode, setDownloadCode] = useState('');
  const navigate = useNavigate();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = downloadCode.trim().toUpperCase();
    if (cleanCode.length === 8) {
      navigate(`/d/${cleanCode}`);
    } else {
      alert('Please enter a valid 8-character code');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 py-10 max-w-6xl mx-auto space-y-20">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Zero-Knowledge • AES-256-GCM • Private Cloud Vault</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.15]">
          Share files privately.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            No limits, zero logs.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Files are split into 19 MB chunks, encrypted client-side with AES-256-GCM in Web Workers,
          and stored safely in a private cloud vault. Receivers need no account.
        </p>

        {/* Enter Code Box */}
        <div className="pt-2 max-w-md mx-auto">
          <form
            onSubmit={handleCodeSubmit}
            className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-2xl backdrop-blur-xl"
          >
            <Input
              type="text"
              placeholder="Enter 8-character code..."
              value={downloadCode}
              onChange={(e) => setDownloadCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="bg-transparent border-0 text-center font-mono font-bold tracking-widest text-base uppercase focus:ring-0 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
            />
            <Button type="submit" size="md" className="flex-shrink-0">
              <Download className="w-4 h-4 mr-1.5" /> Download
            </Button>
          </form>
        </div>
      </section>

      {/* Upload Dropzone Section */}
      <section className="w-full">
        <Dropzone />
      </section>

      {/* 3-Step "How It Works" */}
      <section className="w-full space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">How Sendikko Works</h2>
          <p className="text-sm text-slate-400">Simple for you. Mathematically impossible for eavesdroppers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
              1
            </div>
            <h3 className="text-base font-semibold text-slate-100">Client-Side Slicing & Encryption</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your browser uses <code className="text-indigo-300">Blob.slice</code> to divide files into 19 MB chunks.
              Each chunk is encrypted with AES-256-GCM before it ever leaves your machine.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold">
              2
            </div>
            <h3 className="text-base font-semibold text-slate-100">Distributed Chunk Relay</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Encrypted chunks stream through the backend directly into a high-availability private object store.
              Storage nodes only receive ciphertext and cannot read your contents.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold">
              3
            </div>
            <h3 className="text-base font-semibold text-slate-100">Instant Download & Decrypt</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recipients enter the 8-character code or link. The key in the URL fragment (<code className="text-pink-300">#k=...</code>)
              decrypts chunks directly in the browser and saves to disk.
            </p>
          </div>
        </div>
      </section>

      {/* Security Architecture Explainer */}
      <section className="w-full p-8 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-purple-950/30 border border-indigo-500/20 backdrop-blur-xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <EyeOff className="w-3.5 h-3.5" /> Zero-Knowledge Guarantee
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-100">
              We cannot read your files. Even if compelled.
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sendikko uses a dual key model. If you share via link, the 256-bit AES key lives strictly in the URL
              fragment (<code className="text-indigo-300">#k=...</code>), which web standards guarantee is never sent
              over HTTP headers. If password protected, keys are derived with PBKDF2 (600,000 iterations).
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>96-bit random IV per chunk</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Chunk index bound as AAD</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Salted SHA-256 IP hashing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Burn after N downloads</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
            <p className="text-slate-500">// Client-Side AES-256-GCM Verification</p>
            <p><span className="text-indigo-400">const</span> key = <span className="text-emerald-400">await</span> crypto.subtle.importKey(...);</p>
            <p><span className="text-indigo-400">const</span> aad = <span className="text-pink-400">new</span> Uint8Array(4); <span className="text-slate-500">// binds chunkIdx</span></p>
            <p><span className="text-indigo-400">const</span> ciphertext = <span className="text-emerald-400">await</span> crypto.subtle.encrypt({'{'}</p>
            <p className="pl-4">name: <span className="text-amber-300">'AES-GCM'</span>,</p>
            <p className="pl-4">iv: chunkRandomIv,</p>
            <p className="pl-4">additionalData: aad</p>
            <p>{'}'}, key, chunkBlob);</p>
            <p className="text-emerald-400 pt-2">✓ Verified: Zero unencrypted bytes leave your device.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-slate-100 text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200">How do receivers download files?</h4>
            <p className="text-xs text-slate-400 mt-1">
              They open the link (e.g. <code className="text-indigo-300">/d/7K9N3W2X</code>) or enter the 8-character code
              directly on this homepage. No account or Google sign-in is ever needed to download.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200">Why are files split into 19 MB chunks?</h4>
            <p className="text-xs text-slate-400 mt-1">
              Splitting large files into lightweight 19 MB chunks enables parallel streaming, instant resumes, and ensures 100% reliable uploads and downloads without buffering whole files in server RAM.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200">What happens when a file is deleted?</h4>
            <p className="text-xs text-slate-400 mt-1">
              Deleted files enter a 7-day trash. When permanently deleted (or expired), Sendikko permanently purges and erases all chunk blobs from the vault.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
