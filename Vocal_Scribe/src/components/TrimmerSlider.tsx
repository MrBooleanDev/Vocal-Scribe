import React from 'react';
import { Scissors, Clock } from 'lucide-react';
import { formatTime } from '../utils/audioUtils';

interface TrimmerSliderProps {
  videoDuration: number;
  selectedStart: number;
  selectedDuration: number; // usually 30s or videoDuration
  onChangeStart: (newStart: number) => void;
  disabled?: boolean;
}

export const TrimmerSlider: React.FC<TrimmerSliderProps> = ({
  videoDuration,
  selectedStart,
  selectedDuration,
  onChangeStart,
  disabled = false,
}) => {
  if (videoDuration <= 30.5) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Clip duration: <strong>{formatTime(videoDuration)}</strong> (Within 30s limit)</span>
        </div>
        <span className="text-emerald-400 font-medium">Full clip will be transcribed</span>
      </div>
    );
  }

  const maxStart = Math.max(0, videoDuration - 30);
  const endSec = Math.min(videoDuration, selectedStart + 30);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChangeStart(val);
  };

  const startPercent = (selectedStart / videoDuration) * 100;
  const widthPercent = (30 / videoDuration) * 100;

  return (
    <div className="p-3.5 rounded-xl bg-slate-800/60 border border-indigo-500/30 space-y-2.5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs">
        <div className="flex items-center gap-2 text-indigo-300 font-medium">
          <Scissors className="w-3.5 h-3.5" />
          <span>Choose a 30-second section</span>
        </div>
        <div className="text-slate-300 font-mono">
          Transcribing: <strong className="text-white">{formatTime(selectedStart)}</strong> to <strong className="text-white">{formatTime(endSec)}</strong>
        </div>
      </div>

      {/* Visual range track */}
      <div className="relative h-6 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
        {/* Selected 30s window highlight */}
        <div
          className="absolute top-0 bottom-0 bg-indigo-600/40 border-x-2 border-indigo-400 flex items-center justify-center text-[10px] font-bold text-indigo-200 pointer-events-none"
          style={{
            left: `${startPercent}%`,
            width: `${widthPercent}%`,
          }}
        >
          30s Window
        </div>

        {/* Interactive range slider */}
        <input
          type="range"
          min={0}
          max={maxStart}
          step={0.5}
          value={selectedStart}
          disabled={disabled}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          aria-label="Select 30-second transcription window"
        />
      </div>

      <div className="hidden">
        <span>00:00.0</span>
        <span>Drag slider to choose which 30-second segment to transcribe</span>
        <span>{formatTime(videoDuration)}</span>
      </div>
    </div>
  );
};
