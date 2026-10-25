import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Search,
  Clock,
  FileText,
  FileCode,
  Edit2,
  Share2,
} from 'lucide-react';
import {
  TranscriptionSegment,
  formatTime,
  exportToSrt,
  exportToVtt,
  exportToTxt,
  exportToJson,
} from '../utils/audioUtils';

interface TranscriptViewProps {
  segments: TranscriptionSegment[];
  onSegmentClick: (startTime: number) => void;
  activeTime?: number;
  videoDuration?: number;
  filename?: string;
  onUpdateSegments?: (newSegments: TranscriptionSegment[]) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  segments,
  onSegmentClick,
  activeTime = 0,
  videoDuration = 0,
  filename = 'video',
  onUpdateSegments,
}) => {
  const [viewMode, setViewMode] = useState<'segments' | 'text'>('segments');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  const fullText = segments.map((s) => s.text.trim()).join(' ');
  const wordsCount = fullText.split(/\s+/).filter(Boolean).length;
  const wpm = videoDuration > 0 ? Math.round((wordsCount / videoDuration) * 60) : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srt = exportToSrt(segments);
    downloadFile(srt, `${filename.replace(/\.[^/.]+$/, '')}_subtitles.srt`, 'text/plain');
  };

  const handleDownloadVtt = () => {
    const vtt = exportToVtt(segments);
    downloadFile(vtt, `${filename.replace(/\.[^/.]+$/, '')}_captions.vtt`, 'text/vtt');
  };

  const handleDownloadTxt = () => {
    const txt = exportToTxt(segments);
    downloadFile(txt, `${filename.replace(/\.[^/.]+$/, '')}_transcript.txt`, 'text/plain');
  };

  const handleDownloadJson = () => {
    const json = exportToJson(segments, { filename, duration: videoDuration });
    downloadFile(json, `${filename.replace(/\.[^/.]+$/, '')}_transcript.json`, 'application/json');
  };

  const filteredSegments = searchQuery.trim()
    ? segments.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full min-h-0">
      {/* Top Header & Controls */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode('segments')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'segments'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timestamped ({segments.length})
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'text'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Full Text
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <span><strong>{wordsCount}</strong> words</span>
            <span><strong>{wpm}</strong> WPM</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-medium transition-colors cursor-pointer"
            title="Copy plain text transcript"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={handleDownloadTxt}
              className="px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition-colors font-medium cursor-pointer"
              title="Download as .TXT"
            >
              .TXT
            </button>
            <button
              onClick={handleDownloadSrt}
              className="px-2 py-1 rounded hover:bg-slate-700 text-indigo-300 transition-colors font-medium cursor-pointer"
              title="Download as .SRT Subtitles"
            >
              .SRT
            </button>
            <button
              onClick={handleDownloadVtt}
              className="px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition-colors font-medium cursor-pointer"
              title="Download as .VTT Web Subtitles"
            >
              .VTT
            </button>
            <button
              onClick={handleDownloadJson}
              className="px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition-colors font-medium cursor-pointer"
              title="Download as .JSON"
            >
              .JSON
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar for Segments View */}
      {viewMode === 'segments' && (
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search words in transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2">
        {viewMode === 'segments' ? (
          filteredSegments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No matching spoken text found for "{searchQuery}".
            </div>
          ) : (
            filteredSegments.map((segment) => {
              const isActive = activeTime >= segment.start && activeTime <= segment.end;

              return (
                <div
                  key={segment.id}
                  onClick={() => onSegmentClick(segment.start)}
                  className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isActive
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Timestamp Pill */}
                  <div
                    className={`shrink-0 flex items-center gap-1 font-mono text-[11px] px-2 py-1 rounded-md transition-colors ${
                      isActive
                        ? 'bg-indigo-500 text-white font-semibold'
                        : 'bg-slate-900 text-indigo-400 group-hover:bg-slate-950 border border-slate-800'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(segment.start)}</span>
                  </div>

                  {/* Spoken Text */}
                  <div className="flex-1">
                    <p
                      className={`text-sm leading-relaxed ${
                        isActive ? 'text-white font-medium' : 'text-slate-300'
                      }`}
                    >
                      {segment.text}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      {formatTime(segment.start)} &rarr; {formatTime(segment.end)} ({(segment.end - segment.start).toFixed(1)}s)
                    </span>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Full Text View */
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-sm leading-relaxed text-slate-200 select-text whitespace-pre-wrap">
            {fullText || 'No text transcribed yet.'}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Click any timestamp to seek video</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
          Synchronized with Player
        </span>
      </div>
    </div>
  );
};
