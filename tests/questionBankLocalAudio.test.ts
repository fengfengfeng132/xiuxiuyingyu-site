import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { questionBankLocalAudioEntries } from '../src/data/questionBankLocalAudio';
import { fetchLocalQuestionBankAudioUrl } from '../src/lib/phonetic';

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

function readWavDurationSeconds(path: string): number {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');

  let sampleRate = 0;
  let byteRate = 0;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    }

    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  expect(sampleRate).toBeGreaterThan(0);
  expect(byteRate).toBeGreaterThan(0);
  expect(dataSize).toBeGreaterThan(0);
  return dataSize / byteRate;
}

describe('question bank local audio catalog', () => {
  it('tracks the first ten non-daily question-bank audio texts', () => {
    expect(questionBankLocalAudioEntries.map((item) => item.text)).toEqual(batchOneTexts);
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

  it('keeps slow question-bank audio meaningfully slower than normal audio', () => {
    questionBankLocalAudioEntries.forEach((entry) => {
      const normalSeconds = readWavDurationSeconds(`public${entry.normal}`);
      const slowSeconds = readWavDurationSeconds(`public${entry.slow}`);
      expect(slowSeconds, entry.text).toBeGreaterThan(normalSeconds * 1.1);
    });
  });
});
