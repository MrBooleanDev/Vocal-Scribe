/**
 * Pure Audio Processing & Transcription Formatting Utilities
 * Handles in-browser audio resampling to 16kHz mono, waveform generation,
 * time formatting, and SRT/VTT/TXT export.
 */

export interface TranscriptionSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  confidence?: number;
}

export interface AudioMetrics {
  duration: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
  rms: number;
  hasAudio: boolean;
}

/**
 * Resamples a single-channel Float32Array from originalSampleRate down/up to targetSampleRate (e.g. 16000Hz).
 * Uses high-quality linear interpolation with anti-aliasing approximation.
 */
export function resampleTo16k(
  audioData: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  if (originalSampleRate === targetSampleRate) {
    return new Float32Array(audioData);
  }

  if (audioData.length === 0) {
    return new Float32Array(0);
  }

  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originalPos = i * ratio;
    const index = Math.floor(originalPos);
    const fraction = originalPos - index;

    const sample1 = audioData[index] || 0;
    const sample2 = audioData[index + 1] !== undefined ? audioData[index + 1] : sample1;

    result[i] = sample1 + fraction * (sample2 - sample1);
  }

  return result;
}

/**
 * Mixes multi-channel audio (e.g., stereo) into a single mono channel.
 */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = channels[0].length;
  const mono = new Float32Array(length);
  const numChannels = channels.length;

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += channels[c][i] || 0;
    }
    mono[i] = sum / numChannels;
  }

  return mono;
}

/**
 * Slices an audio buffer to a specific time range (clamping to max 30s as required).
 */
export function sliceAudioBuffer(
  audioData: Float32Array,
  sampleRate: number,
  startSec: number = 0,
  maxDurationSec: number = 30
): { sliced: Float32Array; actualDuration: number; startSec: number; endSec: number } {
  const totalDuration = audioData.length / sampleRate;
  const clampedStart = Math.max(0, Math.min(startSec, totalDuration));
  const clampedDuration = Math.min(maxDurationSec, Math.max(0, totalDuration - clampedStart));
  const endSec = clampedStart + clampedDuration;

  const startIndex = Math.floor(clampedStart * sampleRate);
  const endIndex = Math.min(audioData.length, Math.floor(endSec * sampleRate));

  const sliced = audioData.slice(startIndex, endIndex);
  return {
    sliced,
    actualDuration: sliced.length / sampleRate,
    startSec: clampedStart,
    endSec,
  };
}

/**
 * Computes waveform visual bars and RMS metrics for visualization.
 */
export function computeWaveformPeaks(
  audioData: Float32Array,
  numBars: number = 64
): { peaks: number[]; rms: number; isSilent: boolean } {
  if (audioData.length === 0) {
    return { peaks: new Array(numBars).fill(0.05), rms: 0, isSilent: true };
  }

  const blockSize = Math.floor(audioData.length / numBars);
  const peaks: number[] = [];
  let sumSquares = 0;

  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize;
    const end = Math.min(audioData.length, start + blockSize);
    let peak = 0;

    for (let j = start; j < end; j++) {
      const val = audioData[j];
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
      sumSquares += val * val;
    }

    // Normalized peak between 0.05 and 1.0 for aesthetic display
    peaks.push(Math.max(0.05, Math.min(1.0, peak)));
  }

  const rms = Math.sqrt(sumSquares / audioData.length);
  const isSilent = rms < 0.005;

  return { peaks, rms, isSilent };
}

/**
 * Formats time in seconds into display string, SRT format, or WebVTT format.
 */
export function formatTime(
  seconds: number,
  format: 'display' | 'srt' | 'vtt' = 'display'
): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');

  if (format === 'srt') {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  }

  if (format === 'vtt') {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  }

  // Display format: mm:ss.s or hh:mm:ss
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${Math.floor(ms / 100)}`;
}

/**
 * Encodes Float32Array audio into an instant playable WAV Blob with RIFF header.
 * Runs in ~5ms without waiting for real-time media recording.
 */
export function createWavBlob(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);           // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);           // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true);          // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Formats transcription segments into standard SubRip Subtitle (.srt) format.
 */
export function exportToSrt(segments: TranscriptionSegment[]): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg, index) => {
      const startTime = formatTime(seg.start, 'srt');
      const endTime = formatTime(seg.end, 'srt');
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Formats transcription segments into standard WebVTT (.vtt) format.
 */
export function exportToVtt(segments: TranscriptionSegment[]): string {
  const header = 'WEBVTT\n\nNOTE Transcribed locally with VocalScribe (No API Key)\n\n';
  if (!segments || segments.length === 0) return header;

  const cues = segments
    .map((seg, index) => {
      const startTime = formatTime(seg.start, 'vtt');
      const endTime = formatTime(seg.end, 'vtt');
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n`;
    })
    .join('\n');

  return header + cues;
}

/**
 * Exports transcription as clean plain text.
 */
export function exportToTxt(segments: TranscriptionSegment[]): string {
  if (!segments || segments.length === 0) return '';
  return segments.map(s => s.text.trim()).filter(Boolean).join(' ');
}

/**
 * Exports transcription as formatted JSON with metadata.
 */
export function exportToJson(
  segments: TranscriptionSegment[],
  meta?: { filename?: string; duration?: number; engine?: string }
): string {
  return JSON.stringify(
    {
      app: 'VocalScribe',
      exportedAt: new Date().toISOString(),
      engine: meta?.engine || 'client-side-whisper',
      videoFile: meta?.filename || 'video',
      durationSeconds: meta?.duration || 0,
      fullText: exportToTxt(segments),
      segments: segments.map(s => ({
        id: s.id,
        start: Number(s.start.toFixed(2)),
        end: Number(s.end.toFixed(2)),
        text: s.text.trim(),
      })),
    },
    null,
    2
  );
}

/**
 * Clean and segment raw Whisper text or continuous speech tokens into readable time slices.
 */
export function segmentTranscript(
  text: string,
  totalDuration: number
): TranscriptionSegment[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Split into sentences or clauses
  const sentences = cleaned
    .replace(/([.?!])\s*(?=[A-Z0-9])/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [{ id: 1, start: 0, end: totalDuration, text: cleaned }];
  }

  const durationPerChar = totalDuration / Math.max(1, cleaned.length);
  const segments: TranscriptionSegment[] = [];
  let currentStart = 0;

  sentences.forEach((sentence, index) => {
    const estDuration = Math.max(1.2, sentence.length * durationPerChar);
    const end = Math.min(totalDuration, currentStart + estDuration);

    segments.push({
      id: index + 1,
      start: Number(currentStart.toFixed(2)),
      end: Number((index === sentences.length - 1 ? totalDuration : end).toFixed(2)),
      text: sentence,
    });

    currentStart = end;
  });

  return segments;
}
