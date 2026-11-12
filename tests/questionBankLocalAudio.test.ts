import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { questionBankLocalAudioEntries } from '../src/data/questionBankLocalAudio';
import { questionBank } from '../src/data/loadQuestionBank';
import { fetchLocalQuestionBankAudioUrl, fetchLocalUsAudioUrl, fetchLocalUsSlowAudioUrl } from '../src/lib/phonetic';

const batchOneTexts = [
  'keyboard',
  'guitar',
  'trumpet',
  'drum',
  'xylophone',
  'recorder',
  'violin',
  'piano',
  'throw',
  'catch',
];

function readWavMetrics(path: string) {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');

  let sampleRate = 0;
  let byteRate = 0;
  let dataSize = 0;
  let peak = 0;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      expect(chunkSize, path).toBe(16);
      expect(buffer.readUInt16LE(chunkStart), path).toBe(1);
      expect(buffer.readUInt16LE(chunkStart + 2), path).toBe(1);
      expect(buffer.readUInt16LE(chunkStart + 14), path).toBe(16);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    }

    if (chunkId === 'data') {
      dataSize = chunkSize;
      for (let sample = chunkStart; sample + 2 <= chunkStart + chunkSize; sample += 2) {
        peak = Math.max(peak, Math.abs(buffer.readInt16LE(sample)));
      }
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  expect(sampleRate).toBeGreaterThan(0);
  expect(byteRate).toBeGreaterThan(0);
  expect(dataSize).toBeGreaterThan(0);
  return { duration: dataSize / byteRate, peak };
}

describe('question bank local audio catalog', () => {
  it('preserves the original ten audio keys while extending coverage to the current question bank', () => {
    expect(questionBankLocalAudioEntries.slice(0, 10).map((item) => item.text)).toEqual(batchOneTexts);
    expect(new Set(questionBankLocalAudioEntries.map((item) => item.normal)).size).toBe(questionBankLocalAudioEntries.length);
  });

  it('maps normal and slow playback to generated local files', () => {
    expect(fetchLocalQuestionBankAudioUrl('keyboard', 1)).toBe('/audio/question-bank/us/keyboard.wav');
    expect(fetchLocalQuestionBankAudioUrl('keyboard', 0.75)).toBe('/audio/question-bank/us-slow/keyboard.wav');
    expect(fetchLocalQuestionBankAudioUrl('unknown word', 1)).toBeNull();
  });

  it('keeps every catalog entry backed by a normal and slow wav file', () => {
    questionBankLocalAudioEntries.forEach((entry) => {
      expect(existsSync(`public${entry.normal}`), entry.normal).toBe(true);
      expect(existsSync(`public${entry.slow}`), entry.slow).toBe(true);
    });
  });

  it('covers every actual question audio text and its sentence repeat fragments with independent local pairs', () => {
    questionBank.forEach((question) => {
      const text = (question.audioText || question.prompt).trim();
      for (const candidate of [text, ...text.split(/(?<=[.!?])\s+/)]) {
        const normal = fetchLocalUsAudioUrl(candidate) ?? fetchLocalQuestionBankAudioUrl(candidate);
        const slow = fetchLocalUsSlowAudioUrl(candidate) ?? fetchLocalQuestionBankAudioUrl(candidate, 0.75);
        expect(normal, candidate).toBeTruthy();
        expect(slow, candidate).toBeTruthy();
        expect(normal, candidate).not.toBe(slow);
        expect(existsSync(`public${normal}`), candidate).toBe(true);
        expect(existsSync(`public${slow}`), candidate).toBe(true);
      }
    });
  });

  it('keeps every recording audible, unclipped, canonical PCM and meaningfully slower in the slow variant', () => {
    questionBankLocalAudioEntries.forEach((entry) => {
      const normal = readWavMetrics(`public${entry.normal}`);
      const slow = readWavMetrics(`public${entry.slow}`);
      for (const recording of [normal, slow]) {
        expect(recording.peak, entry.text).toBeGreaterThan(0);
        expect(recording.peak, entry.text).toBeLessThan(32767);
      }
      expect(slow.duration, entry.text).toBeGreaterThan(normal.duration * 1.1);
    });
  });
});
