import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUploadStore } from '../stores/upload.store.ts';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import {
  Camera,
  Video,
  Mic,
  RotateCcw,
  Check,
  StopCircle,
  Radio,
  Sparkles,
  Volume2,
} from 'lucide-react';

export interface LiveCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CaptureMode = 'photo' | 'video' | 'audio';

export const LiveCaptureModal = ({ isOpen, onClose }: LiveCaptureModalProps) => {
  const { enqueueFiles } = useUploadStore();
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<{ blob: Blob; type: CaptureMode; url: string } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Start media stream based on mode
  const startStream = async (targetMode: CaptureMode, currentFacing = facingMode) => {
    // Stop existing stream first
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    try {
      let newStream: MediaStream;
      if (targetMode === 'audio') {
        newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: targetMode === 'video',
        });
      }
      setStream(newStream);
      if (videoRef.current && targetMode !== 'audio') {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      alert(`Could not access ${targetMode === 'audio' ? 'microphone' : 'camera'}: ` + err.message);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedBlob) {
      startStream(mode);
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, mode, capturedBlob]);

  // Flip camera between front/back
  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    await startStream(mode, nextFacing);
  };

  // 1. Take Photo
  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontal if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedBlob({ blob, type: 'photo', url });
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // 2. Start Video / Audio Recording
  const startRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];

    const options = { mimeType: mode === 'audio' ? 'audio/webm' : 'video/webm' };
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const mime = mode === 'audio' ? 'audio/webm' : 'video/webm';
      const fullBlob = new Blob(recordedChunksRef.current, { type: mime });
      const url = URL.createObjectURL(fullBlob);
      setCapturedBlob({ blob: fullBlob, type: mode, url });
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };

    mediaRecorder.start(200);
    setIsRecording(true);
    setRecordDuration(0);

    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  // Stop Video / Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Retake
  const handleRetake = () => {
    if (capturedBlob?.url) {
      URL.revokeObjectURL(capturedBlob.url);
    }
    setCapturedBlob(null);
    setRecordDuration(0);
    startStream(mode);
  };

  // Confirm and upload
  const handleConfirmUpload = () => {
    if (!capturedBlob) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let ext = 'jpg';
    let mime = 'image/jpeg';

    if (capturedBlob.type === 'video') {
      ext = 'webm';
      mime = 'video/webm';
    } else if (capturedBlob.type === 'audio') {
      ext = 'webm';
      mime = 'audio/webm';
    }

    const fileName = `[LIVE]_${capturedBlob.type}_${timestamp}.${ext}`;
    const file = new File([capturedBlob.blob], fileName, { type: mime });

    enqueueFiles([file], {});
    onClose();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        onClose();
      }}
      title="Capture Live Media"
      description="Record live photo, video or audio directly into your vault"
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Mode Selector Tabs (only when not reviewing) */}
        {!capturedBlob && (
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => {
                setMode('photo');
                startStream('photo');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'photo'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Photo
            </button>
            <button
              onClick={() => {
                setMode('video');
                startStream('video');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'video'
                  ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
            <button
              onClick={() => {
                setMode('audio');
                startStream('audio');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'audio'
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> Audio
            </button>
          </div>
        )}

        {/* Viewfinder / Media Display */}
        <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
          {capturedBlob ? (
            /* Review Preview */
            capturedBlob.type === 'photo' ? (
              <img
                src={capturedBlob.url}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            ) : capturedBlob.type === 'video' ? (
              <video
                src={capturedBlob.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center animate-bounce">
                  <Volume2 className="w-8 h-8" />
                </div>
                <audio src={capturedBlob.url} controls className="w-64" />
                <span className="text-xs text-slate-400">Live Audio Recording Verified</span>
              </div>
            )
          ) : mode === 'audio' ? (
            /* Audio Live Visualizer */
            <div className="flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white shadow-2xl shadow-rose-500/50 scale-110 animate-pulse'
                    : 'bg-violet-500/20 text-violet-400'
                }`}
              >
                <Mic className="w-10 h-10" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-100">
                  {isRecording ? 'Recording Live Audio...' : 'Ready to record voice or audio'}
                </p>
                {isRecording && (
                  <p className="text-sm font-mono text-rose-400 mt-1 font-bold">
                    {formatTimer(recordDuration)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Camera Live Viewfinder */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* LIVE overlay indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-bold text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>LIVE FEED</span>
              </div>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-colors"
                title="Switch Camera"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Recording timer badge */}
              {isRecording && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600/90 text-white font-mono text-xs font-bold tracking-wider shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {formatTimer(recordDuration)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {capturedBlob ? (
            /* Review Controls */
            <>
              <Button variant="outline" onClick={handleRetake} className="w-1/2">
                <RotateCcw className="w-4 h-4 mr-1.5" /> Retake
              </Button>
              <Button onClick={handleConfirmUpload} className="w-1/2">
                <Check className="w-4 h-4 mr-1.5" /> Save to Vault
              </Button>
            </>
          ) : (
            /* Capture Controls */
            <div className="w-full flex items-center justify-center gap-4">
              {mode === 'photo' && (
                <button
                  type="button"
                  onClick={takePhoto}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-red-500 p-1 shadow-xl shadow-rose-500/30 active:scale-95 transition-transform"
                >
                  <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
              )}

              {(mode === 'video' || mode === 'audio') && (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-16 h-16 rounded-full p-1 shadow-xl active:scale-95 transition-all ${
                    isRecording
                      ? 'bg-rose-600 shadow-rose-600/50 scale-105'
                      : 'bg-gradient-to-tr from-red-500 to-rose-600 shadow-rose-500/30'
                  }`}
                >
                  <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center text-white">
                    {isRecording ? <StopCircle className="w-7 h-7" /> : <div className="w-6 h-6 rounded-full bg-white" />}
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
