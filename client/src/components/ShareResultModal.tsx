import { useState } from 'react';
import { useUploadStore } from '../stores/upload.store.ts';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import { QRCodeModal } from './QRCodeModal.tsx';
import { Copy, Check, QrCode, Share2, Shield, Lock, Film, ExternalLink } from 'lucide-react';

export const ShareResultModal = () => {
  const { completedFile, isResultModalOpen, closeResultModal } = useUploadStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedStreamLink, setCopiedStreamLink] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (!completedFile) return null;

  const code = completedFile.code || '';
  const isVideo =
    completedFile.file?.type?.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(completedFile.name);
  const streamWatchUrl = `${window.location.origin}/v/${code}`;
  
  // Always derive shareUrl dynamically from current browser origin to prevent stale/hardcoded domains
  let shareUrl = `${window.location.origin}/d/${code}`;
  if (completedFile.keyHex) {
    shareUrl = `${shareUrl}#k=${completedFile.keyHex}`;
  } else if (completedFile.shareUrl && completedFile.shareUrl.includes('#k=')) {
    shareUrl = `${shareUrl}#k=${completedFile.shareUrl.split('#k=')[1]}`;
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      alert('Link: ' + shareUrl);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      alert('Code: ' + code);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Download ${completedFile.name} on Sendikko`,
          text: `Download file with code: ${code}`,
          url: shareUrl,
        });
      } catch {
        // User aborted share dialog
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <>
      <Dialog
        isOpen={isResultModalOpen}
        onClose={closeResultModal}
        title="File Ready to Share"
        description="End-to-end encrypted and safely stored in the cloud vault"
        maxWidth="md"
      >
        <div className="flex flex-col gap-6 pt-2">
          {/* Big 8-Character Unique Code Display */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950/30 border border-indigo-500/20 text-center">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mb-2">
              8-Character Download Code
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-white drop-shadow-md">
                {code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Receivers can enter this 8-character code on the homepage without an account.
            </p>
          </div>

          {/* Share Link Row */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Shareable URL</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-300 font-mono truncate focus:outline-none"
              />
              <Button size="sm" onClick={handleCopyLink} className="flex-shrink-0">
                {copiedLink ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Video Stream & Reddit Showcase (If Video) */}
          {isVideo && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 via-slate-900 to-amber-950/20 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold text-orange-200 uppercase tracking-wider">
                    Reddit Video Stream Ready
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold">
                  RedGIFs Alternative
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Stream this video directly in Reddit posts, Discord, or iframes with auto-looping and sound toggle.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={streamWatchUrl}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-300 font-mono truncate focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(streamWatchUrl);
                    setCopiedStreamLink(true);
                    setTimeout(() => setCopiedStreamLink(false), 2000);
                  }}
                  className="flex-shrink-0"
                >
                  {copiedStreamLink ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copiedStreamLink ? 'Copied' : 'Copy'}
                </Button>
                <a
                  href={streamWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setQrOpen(true)}>
              <QrCode className="w-4 h-4 mr-2 text-indigo-400" /> Show QR Code
            </Button>
            <Button variant="secondary" onClick={handleNativeShare}>
              <Share2 className="w-4 h-4 mr-2 text-purple-400" /> Share via App
            </Button>
          </div>

          {/* Zero-knowledge notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              {completedFile.options.password ? (
                <>Password-protected with client PBKDF2/Argon2. Only holders of the password can decrypt.</>
              ) : (
                <>The 256-bit decryption key is in the URL fragment (<code className="text-indigo-300">#k=...</code>) and is never sent to the server.</>
              )}
            </span>
          </div>

          <Button className="w-full mt-2" onClick={closeResultModal}>
            Done
          </Button>
        </div>
      </Dialog>

      <QRCodeModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        url={shareUrl}
        code={code}
      />
    </>
  );
};
