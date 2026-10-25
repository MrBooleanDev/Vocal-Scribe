import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RotateCcw, Layers } from 'lucide-react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { TrimmerSlider } from './components/TrimmerSlider';
import { TranscriptView } from './components/TranscriptView';
import {
  extractAudioFromMedia,
  transcribeWithWhisper,
  ExtractionResult,
  ProgressUpdate,
} from './utils/transcriber';
import { TranscriptionSegment } from './utils/audioUtils';

export default function App() {
  // Media State
  const [file, setFile] = useState<File | Blob | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Audio Extraction State
  const [extractedAudio, setExtractedAudio] = useState<ExtractionResult | null>(null);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [selectedStart, setSelectedStart] = useState<number>(0);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);

  // Transcription Engine & Progress State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Video Playback synchronization
  const [activeTime, setActiveTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Clean up object URLs when unmounting or changing files
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleFileSelected = async (
    selectedFile: File | Blob,
    name: string
  ) => {
    // Reset previous session
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setFilename(name);
    setVideoUrl(url);
    setSegments([]);
    setErrorMessage(null);
    setSelectedStart(0);
    setExtractedAudio(null);

    // Automatically begin extracting and pre-analyzing audio
    try {
      setIsExtractingAudio(true);
      const extraction = await extractAudioFromMedia(selectedFile, 0, 30);
      setExtractedAudio(extraction);
      setSelectedDuration(extraction.duration);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not extract audio track from video.');
    } finally {
      setIsExtractingAudio(false);
    }
  };

  const handleTrimmerChange = async (newStart: number) => {
    setSelectedStart(newStart);
    if (!file) return;

    try {
      setIsExtractingAudio(true);
      const extraction = await extractAudioFromMedia(file, newStart, 30);
      setExtractedAudio(extraction);
      setSelectedDuration(extraction.duration);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to slice audio.');
    } finally {
      setIsExtractingAudio(false);
    }
  };

  const handleStartTranscription = async () => {
    if (!file) return;
    setErrorMessage(null);
    setIsTranscribing(true);

    try {
      let currentAudio = extractedAudio;

      // Extract if not already cached
      if (!currentAudio) {
        setProgress({
          status: 'extracting-audio',
          message: 'Extracting audio from video file with Web Audio API...',
          progressPercent: 15,
        });
        currentAudio = await extractAudioFromMedia(file, selectedStart, 30);
        setExtractedAudio(currentAudio);
      }

      if (currentAudio.isSilent) {
        setErrorMessage(
          'Notice: The audio in this video appears to be silent or very quiet. Continuing transcription anyway...'
        );
      }

      const result = await transcribeWithWhisper(
        currentAudio.audioData16k,
        currentAudio.duration,
        'Xenova/whisper-tiny.en',
        setProgress
      );
      setSegments(result.segments);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMessage(
        err.message || 'Transcription failed. Please try again or choose another file.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFilename('');
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setExtractedAudio(null);
    setSegments([]);
    setErrorMessage(null);
    setProgress(null);
  };

  const handleSegmentClick = (startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime + selectedStart;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="app-shell bg-slate-950 text-slate-100 font-sans">
      <Header />
      <main className="app-main">
        {errorMessage && <div role="alert" className="notice"><span>{errorMessage}</span><button onClick={() => setErrorMessage(null)} aria-label="Dismiss notice">×</button></div>}
        {!videoUrl ? (
          <div className="upload-stage"><VideoUploader onFileSelected={handleFileSelected} isProcessing={isExtractingAudio} /></div>
        ) : (
          <>
            <div className="file-bar">
              <div className="min-w-0"><h2 className="truncate text-sm font-medium">{filename}</h2><p className="text-xs text-slate-400">{extractedAudio ? `${extractedAudio.videoDuration.toFixed(1)} seconds · English` : 'Reading your file…'}</p></div>
              <button className="secondary-button" onClick={handleReset} disabled={isTranscribing || isExtractingAudio}><RotateCcw size={14} />Change file</button>
            </div>
            <div className="workspace-grid">
              <section className="media-column" aria-label="Media preview and transcription">
                <VideoPlayer videoUrl={videoUrl} segments={segments.map(s => ({...s, start:s.start + selectedStart, end:s.end + selectedStart}))} activeSegmentId={null} videoRef={videoRef} onTimeUpdate={setActiveTime} />
                {extractedAudio && extractedAudio.videoDuration > 30 && <TrimmerSlider videoDuration={extractedAudio.videoDuration} selectedStart={selectedStart} selectedDuration={selectedDuration} onChangeStart={handleTrimmerChange} disabled={isTranscribing || isExtractingAudio} />}
                <div className="action-row"><span className="text-xs text-slate-400">English · Up to 30 seconds</span><button className="primary-button" onClick={handleStartTranscription} disabled={isTranscribing || isExtractingAudio}><Sparkles size={16}/>{isExtractingAudio ? 'Preparing…' : isTranscribing ? 'Transcribing…' : segments.length ? 'Transcribe again' : 'Transcribe'}</button></div>
                {isTranscribing && progress && <div className="compact-progress" role="status"><div className="flex justify-between gap-3 text-xs"><span>{progress.message}</span><span>{Math.round(progress.progressPercent ?? 0)}%</span></div><progress className="w-full accent-indigo-500" max="100" value={progress.progressPercent ?? 0}/></div>}
              </section>
              <section className="transcript-column" aria-label="Transcript">
                {segments.length ? <TranscriptView segments={segments} onSegmentClick={handleSegmentClick} activeTime={activeTime-selectedStart} videoDuration={extractedAudio?.duration || 0} filename={filename} onUpdateSegments={setSegments}/> : <div className="transcript-empty"><div className="empty-icon"><Layers size={24}/></div><h2 className="text-lg font-semibold">Your transcript goes here</h2><p className="text-sm text-slate-400 max-w-xs">Select Transcribe to turn your recording into text.</p><span className="text-xs text-slate-500">Download TXT, SRT, VTT or JSON</span></div>}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
