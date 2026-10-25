import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Subtitles,
  Gauge,
} from 'lucide-react';
import { TranscriptionSegment, formatTime } from '../utils/audioUtils';

interface VideoPlayerProps {
  videoUrl: string;
  segments: TranscriptionSegment[];
  activeSegmentId: number | null;
  waveformPeaks?: number[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (time: number) => void;
  onSeek?: (time: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  segments,
  activeSegmentId,
  waveformPeaks = [],
  videoRef,
  onTimeUpdate,
  onSeek,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    onSeek?.(time);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setVolume(val);
    setIsMuted(val === 0);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
    setPlaybackRate(nextRate);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="media-player relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 group flex flex-col"
    >
      {/* Video Canvas Container */}
      <div className="media-canvas relative w-full bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />

        {/* Live Subtitle Overlay */}
        {showSubtitles && activeSegment && (
          <div className="absolute bottom-14 left-4 right-4 pointer-events-none flex justify-center text-center">
            <div className="px-4 py-1.5 rounded-lg bg-black/85 backdrop-blur-sm border border-white/10 shadow-lg max-w-xl">
              <p className="text-white font-medium text-sm sm:text-base leading-snug drop-shadow-md">
                {activeSegment.text}
              </p>
            </div>
          </div>
        )}

        {/* Big play button on pause */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform cursor-pointer"
            aria-label="Play video"
          >
            <Play className="w-7 h-7 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* Synchronized Audio Waveform Bars */}
      {waveformPeaks.length > 0 && (
        <div className="h-10 bg-slate-900/90 border-t border-slate-800/80 px-4 flex items-center gap-[2px]">
          {waveformPeaks.map((peak, idx) => {
            const barProgress = (idx / waveformPeaks.length) * 100;
            const isPassed = barProgress <= progressPercent;
            const heightPx = Math.max(4, Math.round(peak * 30));

            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full cursor-pointer hover:opacity-80"
                onClick={() => {
                  const targetTime = (idx / waveformPeaks.length) * duration;
                  if (videoRef.current) {
                    videoRef.current.currentTime = targetTime;
                  }
                }}
                title={`Seek to ${formatTime((idx / waveformPeaks.length) * duration)}`}
              >
                <div
                  className={`w-full rounded-full transition-colors ${
                    isPassed ? 'bg-indigo-400' : 'bg-slate-700/60'
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Scrub Bar */}
      <div className="px-4 pt-2 bg-slate-900">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            aria-label="Seek video progress"
          />
        </div>
      </div>

      {/* Player Controls Bar */}
      <div className="px-3 py-2 bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-slate-300 text-xs">
        {/* Left: Play/Pause, Replay, Time */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Replay from start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-slate-400">
            <span className="text-white font-medium">{formatTime(currentTime)}</span> / {formatTime(duration)}
          </span>
        </div>

        {/* Right: Subtitle toggle, Speed, Volume, Fullscreen */}
        <div className="flex items-center gap-2">
          {segments.length > 0 && (
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                showSubtitles
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle in-video subtitles"
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">CC</span>
            </button>
          )}

          <button
            onClick={cyclePlaybackRate}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-colors"
            title="Change playback speed"
          >
            <Gauge className="w-3 h-3 text-indigo-400" />
            <span>{playbackRate}x</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hidden sm:block"
              aria-label="Volume slider"
            />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
