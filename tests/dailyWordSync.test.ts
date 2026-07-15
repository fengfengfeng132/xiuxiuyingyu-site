import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';
import { fetchLocalUsAudioUrl, fetchLocalUsSlowAudioUrl } from '../src/lib/phonetic';

const expectedWords = [
  'rode',
  'threw',
  'read',
  'wrote',
  'black',
  'flag',
  'sleep',
  'some',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const expectedMeanings = [
  '骑了/乘坐了',
  '扔了',
  '读了',
  '写了',
  '黑色',
  '旗子',
  '睡觉',
  '一些',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
];

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');

function readAudioWordSet(relativeDir: string): string[] {
  return readdirSync(resolve(projectRoot, relativeDir))
    .filter((name) => name.endsWith('.wav'))
    .map((name) => name.replace(/\.wav$/u, ''))
    .sort();
}

function readAudioFileNameSet(relativeDir: string): Set<string> {
  return new Set(readdirSync(resolve(projectRoot, relativeDir)).filter((name) => name.endsWith('.wav')));
}

function audioFileNameFromUrl(url: string): string {
  return decodeURIComponent(url.split('/').at(-1) ?? '');
}

function readWavFormat(relativePath: string): { audioFormat: number; fmtSize: number } {
  const buffer = readFileSync(resolve(projectRoot, relativePath));
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      return {
        audioFormat: buffer.readUInt16LE(offset + 8),
        fmtSize: chunkSize,
      };
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  throw new Error(`Missing fmt chunk: ${relativePath}`);
}

describe('daily word sync', () => {
  it('keeps the dictation word list on the requested 20-word set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 20 words in daily learning questions', () => {
    expect(dailyLearningQuestions).toHaveLength(expectedWords.length);
    expect(dailyLearningQuestions.map((item) => item.prompt)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.audioText)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.explanation)).toEqual(
      expectedWords.map((word, index) => `${word} ${expectedMeanings[index]}`),
    );
  });

  it('keeps normal and slow local audio filenames synced with the current word set', () => {
    expect(readAudioWordSet('public/audio/words/us')).toEqual([...expectedWords].sort());
    expect(readAudioWordSet('public/audio/words/us-slow')).toEqual([...expectedWords].sort());
  });

  it('maps each current word to local audio URLs that exist on disk', () => {
    const normalFileNames = readAudioFileNameSet('public/audio/words/us');
    const slowFileNames = readAudioFileNameSet('public/audio/words/us-slow');

    expectedWords.forEach((word) => {
      const normalUrl = fetchLocalUsAudioUrl(word);
      const slowUrl = fetchLocalUsSlowAudioUrl(word);

      expect(normalUrl).toBeTruthy();
      expect(slowUrl).toBeTruthy();
      expect(normalFileNames.has(audioFileNameFromUrl(normalUrl ?? ''))).toBe(true);
      expect(slowFileNames.has(audioFileNameFromUrl(slowUrl ?? ''))).toBe(true);
    });
  });

  it('keeps daily word WAV headers in canonical PCM format for iPad Safari', () => {
    ['public/audio/words/us', 'public/audio/words/us-slow'].forEach((relativeDir) => {
      expectedWords.forEach((word) => {
        const format = readWavFormat(`${relativeDir}/${word}.wav`);

        expect(format.audioFormat).toBe(1);
        expect(format.fmtSize).toBe(16);
      });
    });
  });

  it('shows the current dictation word count on the mode hub', () => {
    const modeHubSource = readFileSync(resolve(projectRoot, 'src/pages/ModeHubPage.tsx'), 'utf8');

    expect(modeHubSource).toContain('今日 20 词');
    expect(modeHubSource).not.toContain('今日 8 词');
  });
});
