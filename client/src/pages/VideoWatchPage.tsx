import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ApiService, API_BASE_URL } from '../services/api.ts';
import { FileMetadata } from '../types/index.ts';
import { Button } from '../components/ui/Button.tsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { Input } from '../components/ui/Input.tsx';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Maximize2,
  Minimize2,
  RotateCcw,
  Share2,
  Download,
  Copy,
  Check,
  ExternalLink,
  Code,
  Shield,
  Film,
  Lock,
  ArrowLeft,
  Tv,
} from 'lucide-react';

interface VideoWatchPageProps {
  isEmbed?: boolean;
}

export const VideoWatchPage: React.FC<VideoWatchPageProps> = ({ isEmbed = false }) => {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode || '').toUpperCase();

  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password unlock state
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default muted for Reddit/web autoplay
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(true); // Default looping (RedGIFs style)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [unmuteNotice, setUnmuteNotice] = useState(true);

  // Reddit / Share modal
  const [isRedditModalOpen, setIsRedditModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setLoading(true);
        const res = await ApiService.getFileMetadata(code);
        setMetadata(res.data);
        if (!res.data.passwordRequired) {
          setIsUnlocked(true);
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Video not found or expired');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchFile();
    }
  }, [code]);

  // Handle password unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      setUnlockLoading(true);
      setUnlockError(null);
      const res = await ApiService.unlockFile(code, password);
      setUnlockToken(res.data.downloadToken);
      setIsUnlocked(true);
    } catch (err: any) {
      setUnlockError(err.response?.data?.error?.message || 'Incorrect password');
    } finally {
      setUnlockLoading(false);
    }
  };

  const streamSrc = isUnlocked
    ? `${API_BASE_URL}/files/${code}/stream${unlockToken ? `?token=${encodeURIComponent(unlockToken)}` : ''}`
    : '';

  // Autoplay attempt once stream source is ready
  useEffect(() => {
    if (isUnlocked && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isUnlocked, streamSrc]);

  // Player controls handling
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) setUnmuteNotice(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
    if (val > 0) setUnmuteNotice(false);
  };

  const toggleLoop = () => {
    if (!videoRef.current) return;
    const nextLoop = !isLooping;
    videoRef.current.loop = nextLoop;
    setIsLooping(nextLoop);
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    setDuration(videoRef.current.duration || 0);

    // Update buffered progress
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const total = videoRef.current.duration || 1;
      setBufferedPercent(Math.min(100, (bufferedEnd / total) * 100));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const targetTime = parseFloat(e.target.value);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'l') {
        e.preventDefault();
        toggleLoop();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      alert(text);
    }
  };

  const watchUrl = `${window.location.origin}/v/${code}`;
  const embedCode = `<iframe src="${window.location.origin}/v/${code}/embed" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  const redditMarkdown = `[Watch on Sendikko](${watchUrl})`;
  const redditSubmitUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(watchUrl)}&title=${encodeURIComponent(metadata?.nameEnc || 'Sendikko Video')}`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-400 gap-3">
        <Film className="w-8 h-8 text-indigo-400 animate-pulse" />
        <p className="text-sm">Connecting to video stream relay...</p>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
          <Film className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Video Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md">{error || 'This video link may have expired or was removed.'}</p>
        <Link to="/">
          <Button variant="secondary" size="md">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sendikko
          </Button>
        </Link>
      </div>
    );
  }

  // Password Unlock Gate
  if (metadata.passwordRequired && !isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Protected Video Stream</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter the password set by the uploader to stream this video.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={unlockError || undefined}
              autoFocus
            />
            <Button type="submit" className="w-full" isLoading={unlockLoading}>
              Unlock &amp; Watch Stream
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Embed Mode (Clean borderless full viewport player)
  if (isEmbed) {
    return (
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center select-none"
      >
        <video
          ref={videoRef}
          src={streamSrc}
          playsInline
          loop={isLooping}
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Unmute floating pill */}
        {isMuted && unmuteNotice && (
          <button
            onClick={toggleMute}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-white border border-slate-700 shadow-xl backdrop-blur-md transition-transform hover:scale-105"
          >
            <VolumeX className="w-4 h-4 text-rose-400" />
            <span>Click to Unmute</span>
          </button>
        )}

        {/* Floating Custom Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress Scrubber */}
          <div className="relative w-full h-1.5 bg-slate-800/80 rounded-full mb-3 cursor-pointer group">
            <div
              className="absolute left-0 top-0 bottom-0 bg-slate-600/50 rounded-full pointer-events-none"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full pointer-events-none"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-200">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="p-1 hover:text-indigo-400 transition-colors">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={toggleMute} className="p-1 hover:text-indigo-400 transition-colors">
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <span className="font-mono text-[11px] text-slate-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleLoop}
                className={`p-1 transition-colors ${isLooping ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                title={isLooping ? 'Loop ON' : 'Loop OFF'}
              >
                <Repeat className="w-4 h-4" />
              </button>
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Watch on Sendikko"
              >
                <Tv className="w-4 h-4" />
              </a>
              <button onClick={toggleFullscreen} className="p-1 hover:text-indigo-400 transition-colors">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full Standard Watch Page
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sendikko
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
            Stream Relay Active
          </span>
        </div>
      </div>

      {/* Main Cinema Player Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full aspect-video sm:rounded-3xl bg-black border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center select-none group"
      >
        <video
          ref={videoRef}
          src={streamSrc}
          playsInline
          loop={isLooping}
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Center Pause/Play big icon on toggle */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900/80 border border-indigo-500/30 flex items-center justify-center text-white backdrop-blur-md shadow-2xl transition-transform hover:scale-110 pointer-events-auto"
          >
            <Play className="w-8 h-8 ml-1 text-indigo-400" />
          </button>
        )}

        {/* Top-Right Unmute Banner (RedGIFs / Reddit style) */}
        {isMuted && unmuteNotice && (
          <button
            onClick={toggleMute}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-white border border-slate-700 shadow-xl backdrop-blur-md transition-transform hover:scale-105"
          >
            <VolumeX className="w-4 h-4 text-rose-400" />
            <span>Click to Unmute 🔊</span>
          </button>
        )}

        {/* Overlay Custom Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Seekbar with buffer track */}
          <div className="relative w-full h-2 bg-slate-800/90 rounded-full mb-3 cursor-pointer group/seek">
            <div
              className="absolute left-0 top-0 bottom-0 bg-slate-600/50 rounded-full pointer-events-none"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full pointer-events-none"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-200">
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-slate-800/80 hover:text-indigo-400 transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <div className="flex items-center gap-1.5 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg hover:bg-slate-800/80 hover:text-indigo-400 transition-colors"
                  title="Mute / Unmute (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-indigo-500 cursor-pointer"
                />
              </div>

              <span className="font-mono text-xs text-slate-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Loop Toggle */}
              <button
                onClick={toggleLoop}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  isLooping
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Toggle Loop (L)"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Loop {isLooping ? 'ON' : 'OFF'}</span>
              </button>

              {/* Speed Menu */}
              <div className="relative">
                <select
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="bg-slate-900/80 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-slate-800/80 hover:text-indigo-400 transition-colors"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Details & Reddit Share Bar */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white break-all">
              {metadata.nameEnc}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
              <span>{(Number(metadata.size) / (1024 * 1024)).toFixed(1)} MB</span>
              <span>•</span>
              <span className="capitalize">{metadata.mimeEnc}</span>
              <span>•</span>
              <span>8-Char Code: <strong className="text-indigo-300 font-mono">{code}</strong></span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Reddit Modal Trigger */}
            <Button
              onClick={() => setIsRedditModalOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold"
            >
              <Share2 className="w-4 h-4 mr-1.5" /> Share to Reddit
            </Button>

            {/* Direct Download */}
            <a href={`${API_BASE_URL}/files/${code}/stream`} download={metadata.nameEnc}>
              <Button variant="secondary">
                <Download className="w-4 h-4 mr-1.5" /> Download
              </Button>
            </a>
          </div>
        </div>

        {/* Feature info callouts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Zero-Knowledge Relay • Stored securely in cloud vault</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Repeat className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>RedGIFs Alternative • Auto-looping video clips</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Code className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>Embeddable in iframes, Reddit markdown &amp; forums</span>
          </div>
        </div>
      </div>

      {/* Reddit Share Modal */}
      <Dialog
        isOpen={isRedditModalOpen}
        onClose={() => setIsRedditModalOpen(false)}
        title="Share to Reddit &amp; Socials"
        description="Fast, embeddable video streaming links optimized for Reddit, Discord, and forums."
        maxWidth="md"
      >
        <div className="space-y-5 pt-2">
          {/* Option 1: Direct Reddit Submission */}
          <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/30 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-orange-200">Post directly to Reddit</p>
              <p className="text-xs text-orange-400/80">Opens Reddit submission with your video link pre-filled</p>
            </div>
            <a
              href={redditSubmitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Post Now
              </Button>
            </a>
          </div>

          {/* Option 2: Reddit Markdown Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Reddit Markdown Link</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={redditMarkdown}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(redditMarkdown, 'markdown')}
                className="flex-shrink-0"
              >
                {copiedType === 'markdown' ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedType === 'markdown' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Option 3: Direct Stream .mp4 Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Direct Video Stream URL (.mp4 / HTTP 206)</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${API_BASE_URL}/files/${code}/stream`}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(`${API_BASE_URL}/files/${code}/stream`, 'stream')}
                className="flex-shrink-0"
              >
                {copiedType === 'stream' ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedType === 'stream' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Option 4: Iframe Embed Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">HTML Iframe Embed Code</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={embedCode}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className="flex-shrink-0"
              >
                {copiedType === 'embed' ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedType === 'embed' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <Button className="w-full mt-2" variant="secondary" onClick={() => setIsRedditModalOpen(false)}>
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
