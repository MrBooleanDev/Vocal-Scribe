import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resampleTo16k,
  mixToMono,
  sliceAudioBuffer,
  computeWaveformPeaks,
  formatTime,
  createWavBlob,
  exportToSrt,
  exportToVtt,
  exportToTxt,
  exportToJson,
  segmentTranscript,
  TranscriptionSegment,
} from './audioUtils';

test('formatTime formats display time, SRT, and VTT correctly', () => {
  // Display format
  assert.equal(formatTime(0), '00:00.0');
  assert.equal(formatTime(14.5), '00:14.5');
  assert.equal(formatTime(65.2), '01:05.2');
  assert.equal(formatTime(3665), '01:01:05');

  // SRT format: 00:00:14,500
  assert.equal(formatTime(14.5, 'srt'), '00:00:14,500');
  assert.equal(formatTime(0, 'srt'), '00:00:00,000');
  assert.equal(formatTime(125.045, 'srt'), '00:02:05,045');

  // VTT format: 00:00:14.500
  assert.equal(formatTime(14.5, 'vtt'), '00:00:14.500');
});

test('resampleTo16k resamples 48kHz audio to 16kHz correctly', () => {
  const originalRate = 48000;
  const targetRate = 16000;
  // 1 second of 48kHz audio = 48,000 samples
  const input = new Float32Array(48000);
  for (let i = 0; i < input.length; i++) {
    input[i] = Math.sin((2 * Math.PI * 440 * i) / originalRate); // 440Hz tone
  }

  const resampled = resampleTo16k(input, originalRate, targetRate);
  // Resampled 1 second at 16kHz should have 16,000 samples
  assert.equal(resampled.length, 16000);
  assert.equal(resampled instanceof Float32Array, true);
  // Check that values are within reasonable bounds [-1, 1]
  assert.ok(Math.max(...resampled) <= 1.05);
  assert.ok(Math.min(...resampled) >= -1.05);
});

test('mixToMono properly blends stereo channels into single channel', () => {
  const left = new Float32Array([1.0, 0.5, -0.2]);
  const right = new Float32Array([0.0, 0.5, 0.2]);
  const mono = mixToMono([left, right]);

  assert.equal(mono.length, 3);
  assert.ok(Math.abs(mono[0] - 0.5) < 0.001);
  assert.ok(Math.abs(mono[1] - 0.5) < 0.001);
  assert.ok(Math.abs(mono[2] - 0.0) < 0.001);
});

test('sliceAudioBuffer enforces 30-second maximum cap for uploads', () => {
  const sampleRate = 16000;
  // 45 seconds of audio = 45 * 16000 = 720000 samples
  const audioData = new Float32Array(720000);
  
  // Slicing from start 0 with 30s limit
  const result1 = sliceAudioBuffer(audioData, sampleRate, 0, 30);
  assert.equal(result1.actualDuration, 30);
  assert.equal(result1.sliced.length, 30 * sampleRate);
  assert.equal(result1.startSec, 0);
  assert.equal(result1.endSec, 30);

  // Slicing from 10s offset with 30s limit (should give [10s, 40s])
  const result2 = sliceAudioBuffer(audioData, sampleRate, 10, 30);
  assert.equal(result2.actualDuration, 30);
  assert.equal(result2.startSec, 10);
  assert.equal(result2.endSec, 40);

  // Short audio (12 seconds) should not be padded or truncated beyond 12
  const shortAudio = new Float32Array(12 * sampleRate);
  const result3 = sliceAudioBuffer(shortAudio, sampleRate, 0, 30);
  assert.equal(result3.actualDuration, 12);
  assert.equal(result3.endSec, 12);
});

test('computeWaveformPeaks computes correct peak bars and silence detection', () => {
  const silentData = new Float32Array(16000); // 1s silence
  const silentRes = computeWaveformPeaks(silentData, 32);
  assert.equal(silentRes.peaks.length, 32);
  assert.equal(silentRes.isSilent, true);

  // Audio with sound
  const soundData = new Float32Array(16000);
  for (let i = 0; i < soundData.length; i++) {
    soundData[i] = 0.8 * Math.sin(i / 10);
  }
  const soundRes = computeWaveformPeaks(soundData, 32);
  assert.equal(soundRes.isSilent, false);
  assert.ok(soundRes.rms > 0.1);
  assert.ok(soundRes.peaks.some(p => p > 0.5));
});

test('createWavBlob creates valid 44-byte WAV header and PCM data', () => {
  const samples = new Float32Array(16000); // 1s at 16kHz
  samples[0] = 0.5;
  const blob = createWavBlob(samples, 16000);
  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 44 + 16000 * 2);
});

test('exportToSrt and exportToVtt generate valid subtitle format', () => {
  const segments: TranscriptionSegment[] = [
    { id: 1, start: 0, end: 2.5, text: 'Hello world.' },
    { id: 2, start: 2.5, end: 6.0, text: 'This is transcribed without any API key.' },
  ];

  const srt = exportToSrt(segments);
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:02,500\nHello world.'));
  assert.ok(srt.includes('2\n00:00:02,500 --> 00:00:06,000\nThis is transcribed without any API key.'));

  const vtt = exportToVtt(segments);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:00.000 --> 00:00:02.500'));

  const txt = exportToTxt(segments);
  assert.equal(txt, 'Hello world. This is transcribed without any API key.');

  const json = JSON.parse(exportToJson(segments, { duration: 6 }));
  assert.equal(json.segments.length, 2);
  assert.equal(json.fullText, 'Hello world. This is transcribed without any API key.');
});

test('segmentTranscript divides continuous text into timed segments', () => {
  const text = 'Welcome to the presentation. Today we will build an offline video transcriber. It requires no API key at all.';
  const segments = segmentTranscript(text, 15);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].text, 'Welcome to the presentation.');
  assert.equal(segments[2].end, 15);
});
