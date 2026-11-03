import { Shield, Lock, Terminal, Cpu } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-200">Sendikko</span>
            <span className="text-xs text-slate-500">— End-to-End Encrypted File Relay</span>
          </div>
          <p className="text-xs text-slate-500 max-w-sm text-center md:text-left">
            Client-side AES-256-GCM chunk encryption. High-durability private object store. Zero server knowledge.
          </p>
        </div>

        {/* Security badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>AES-256-GCM + PBKDF2</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Encrypted Cloud Vault</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Web Worker Pipeline</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Terminal className="w-3.5 h-3.5 text-pink-400" />
            <span>8-Char Codes</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
