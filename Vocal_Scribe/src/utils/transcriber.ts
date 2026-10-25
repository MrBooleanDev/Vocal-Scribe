/**
 * Client-Side Transcription Engine
 * Runs completely in-browser with zero API keys and zero server dependencies.
 * Supports:
 *  1. In-browser Whisper ML via @xenova/transformers (ONNX WebAssembly)
 *  2. Direct Video Audio Decoding via Web Audio API
 */

import {
  resampleTo16k,
  mixToMono,
  sliceAudioBuffer,
  computeWaveformPeaks,
  segmentTranscript,
  TranscriptionSegment,
} from './audioUtils';

export interface ExtractionResult {
  audioBuffer: AudioBuffer;
  audioData16k: Float32Array;
  originalSampleRate: number;
  duration: number;
  peaks: number[];
  isSilent: boolean;
  videoDuration: number;
  selectedStart: number;
  selectedEnd: number;
}

export interface ProgressUpdate {
  status: 'idle' | 'extracting-audio' | 'loading-model' | 'transcribing' | 'completed' | 'error';
  message: string;
  progressPercent?: number; // 0 to 100
  downloadFile?: string;
  loadedBytes?: number;
  totalBytes?: number;
}

// Global cached pipeline promise to avoid reloading model on multiple transcriptions
let cachedWhisperPipeline: any = null;
let cachedModelName = '';

/**
 * Extracts audio track from any video or audio File / Blob,
 * clamps to max 30 seconds range, and converts to 16kHz mono Float32Array.
 */
export async function extractAudioFromMedia(
  fileOrBlob: Blob,
  startSec: number = 0,
  maxDurationSec: number = 30,
  onProgress?: (progress: number) => void
): Promise<ExtractionResult> {
  onProgress?.(10);
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  onProgress?.(40);

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  // Decode the video/audio container's audio track
  let decodedAudio: AudioBuffer;
  try {
    decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error(
      'Could not decode audio from this video. Please ensure the video has an audio track, or try another video.'
    );
  }

  onProgress?.(70);

  const originalSampleRate = decodedAudio.sampleRate;
  const videoDuration = decodedAudio.duration;

  // Extract channels and mix to mono
  const numChannels = decodedAudio.numberOfChannels;
  const channelDataList: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelDataList.push(decodedAudio.getChannelData(c));
  }
  const monoData = mixToMono(channelDataList);

  // Slice to 30 seconds range
  const { sliced, actualDuration, startSec: clampedStart, endSec: clampedEnd } = sliceAudioBuffer(
    monoData,
    originalSampleRate,
    startSec,
    maxDurationSec
  );

  // Resample down to 16,000 Hz for Whisper / Speech models
  const audioData16k = resampleTo16k(sliced, originalSampleRate, 16000);

  // Compute waveform visual peaks
  const { peaks, isSilent } = computeWaveformPeaks(audioData16k, 64);

  onProgress?.(100);

  return {
    audioBuffer: decodedAudio,
    audioData16k,
    originalSampleRate,
    duration: actualDuration,
    peaks,
    isSilent,
    videoDuration,
    selectedStart: clampedStart,
    selectedEnd: clampedEnd,
  };
}

/**
 * Loads Whisper model in-browser via @xenova/transformers.
 * Quantized model is stored locally in IndexedDB / Cache for subsequent instant loads!
 */
export async function loadWhisperModel(
  modelName: string = 'Xenova/whisper-tiny.en',
  onProgress?: (update: ProgressUpdate) => void
) {
  if (cachedWhisperPipeline && cachedModelName === modelName) {
    return cachedWhisperPipeline;
  }

  onProgress?.({
    status: 'loading-model',
    message: 'Initializing in-browser Whisper ML engine (WebAssembly/ONNX)...',
    progressPercent: 5,
  });

  const { pipeline, env } = await import('@xenova/transformers');

  // Configure environment for pure browser execution
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  cachedWhisperPipeline = await pipeline('automatic-speech-recognition', modelName, {
    progress_callback: (item: any) => {
      if (item.status === 'progress' && item.total) {
        const percent = Math.round((item.loaded / item.total) * 100);
        onProgress?.({
          status: 'loading-model',
          message: `Downloading speech model weights (${item.file || 'model.onnx'}): ${percent}%`,
          progressPercent: percent,
          downloadFile: item.file,
          loadedBytes: item.loaded,
          totalBytes: item.total,
        });
      } else if (item.status === 'initiate') {
        onProgress?.({
          status: 'loading-model',
          message: `Preparing ${item.file || 'model components'}...`,
          progressPercent: 15,
        });
      } else if (item.status === 'done') {
        onProgress?.({
          status: 'loading-model',
          message: `Model component cached ready.`,
          progressPercent: 95,
        });
      }
    },
  });

  cachedModelName = modelName;
  return cachedWhisperPipeline;
}

/**
 * Transcribes 16kHz audio using client-side Whisper.
 */
export async function transcribeWithWhisper(
  audioData16k: Float32Array,
  durationSec: number,
  modelName: string = 'Xenova/whisper-tiny.en',
  onProgress?: (update: ProgressUpdate) => void
): Promise<{ text: string; segments: TranscriptionSegment[] }> {
  const transcriber = await loadWhisperModel(modelName, onProgress);

  onProgress?.({
    status: 'transcribing',
    message: 'Analyzing speech frequencies and generating text tokens...',
    progressPercent: 50,
  });

  const output = await transcriber(audioData16k, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    task: 'transcribe',
  });

  const rawText: string = output?.text || '';
  let segments: TranscriptionSegment[] = [];

  if (Array.isArray(output?.chunks) && output.chunks.length > 0) {
    segments = output.chunks.map((chunk: any, idx: number) => {
      const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] ?? 0 : idx * 3;
      const end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] ?? (start + 3) : (start + 3);
      return {
        id: idx + 1,
        start: Number(start.toFixed(2)),
        end: Number(Math.min(durationSec, end).toFixed(2)),
        text: String(chunk.text || '').trim(),
      };
    }).filter((s: TranscriptionSegment) => s.text.length > 0);
  }

  // If chunk timestamps were not generated, divide into sentence segments
  if (segments.length === 0 && rawText.trim()) {
    segments = segmentTranscript(rawText, durationSec);
  }

  onProgress?.({
    status: 'completed',
    message: 'Transcription successfully generated!',
    progressPercent: 100,
  });

  return {
    text: rawText.trim(),
    segments,
  };
}

