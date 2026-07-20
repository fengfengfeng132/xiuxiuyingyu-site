import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';
import { fetchLocalUsAudioUrl, fetchLocalUsSlowAudioUrl } from '../src/lib/phonetic';

const expectedWords = [
  'eat',
  'ate',
  'run',
  'ran',
  'draw',
  'drew',
  'catch',
  'caught',
  'read',
  'read',
  'ride',
  'rode',
  'write',
  'wrote',
  'throw',
  'threw',
  'tennis',
  'soccer',
  'handball',
  'jump rope',
  'that',
  'do',
  'happy',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
];
const expectedMeanings = [
  '吃',
  '吃了',
  '跑',
  '跑了',
  '画',
  '画了',
  '接住',
  '接住了',
  '读',
  '读了',
  '骑/乘坐',
  '骑了/乘坐了',
  '写',
  '写了',
  '扔',
  '扔了',
  '网球',
  '足球',
  '手球',
  '跳绳',
  '那个',
  '做',
  '开心的',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `字母 ${letter}`),
];
const expectedAudioKeys = expectedWords.map((word, index) => (word === 'read' && index === 9 ? 'read-past' : word));

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

function readWavDurationSeconds(relativePath: string): number {
  const buffer = readFileSync(resolve(projectRoot, relativePath));
  const byteRate = buffer.readUInt32LE(28);
  const dataOffset = buffer.indexOf(Buffer.from('data'));

  if (dataOffset < 0 || byteRate === 0) throw new Error(`Invalid WAV file: ${relativePath}`);
  return buffer.readUInt32LE(dataOffset + 4) / byteRate;
}

describe('daily word sync', () => {
  it('keeps the dictation word list on the requested 49-entry set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 49 entries in daily learning questions', () => {
    expect(dailyLearningQuestions).toHaveLength(expectedWords.length);
    expect(dailyLearningQuestions.map((item) => item.prompt)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.audioText)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.audioKey ?? item.audioText)).toEqual(expectedAudioKeys);
  });

  it('keeps present and past read as separate entries with separate pronunciation data', () => {
    const readEntries = dictationWords.filter((item) => item.word === 'read');

    expect(readEntries).toHaveLength(2);
    expect(readEntries.map((item) => item.phonetic)).toEqual(['/riːd/', '/red/']);
    expect(readEntries.map((item) => item.audioKey ?? item.word)).toEqual(['read', 'read-past']);
  });

  it('marks every requested past-tense entry in both learning flows', () => {
    const expectedPastTenseWords = ['ate', 'ran', 'drew', 'caught', 'read', 'rode', 'wrote', 'threw'];

    expect(dictationWords.filter((item) => item.grammarLabel === '过去式').map((item) => item.word)).toEqual(
      expectedPastTenseWords,
    );
    expect(dailyLearningQuestions.filter((item) => item.grammarLabel === '过去式').map((item) => item.prompt)).toEqual(
      expectedPastTenseWords,
    );
  });

  it('keeps normal and slow local audio filenames synced with the current word set', () => {
    expect(readAudioWordSet('public/audio/words/us')).toEqual([...expectedAudioKeys].sort());
    expect(readAudioWordSet('public/audio/words/us-slow')).toEqual([...expectedAudioKeys].sort());
  });

  it('maps each current word to local audio URLs that exist on disk', () => {
    const normalFileNames = readAudioFileNameSet('public/audio/words/us');
    const slowFileNames = readAudioFileNameSet('public/audio/words/us-slow');

    expectedAudioKeys.forEach((audioKey) => {
      const normalUrl = fetchLocalUsAudioUrl(audioKey);
      const slowUrl = fetchLocalUsSlowAudioUrl(audioKey);

      expect(normalUrl).toBeTruthy();
      expect(slowUrl).toBeTruthy();
      expect(normalFileNames.has(audioFileNameFromUrl(normalUrl ?? ''))).toBe(true);
      expect(slowFileNames.has(audioFileNameFromUrl(slowUrl ?? ''))).toBe(true);
    });
  });

  it('keeps daily word WAV headers in canonical PCM format for iPad Safari', () => {
    ['public/audio/words/us', 'public/audio/words/us-slow'].forEach((relativeDir) => {
      expectedAudioKeys.forEach((audioKey) => {
        const format = readWavFormat(`${relativeDir}/${audioKey}.wav`);

        expect(format.audioFormat).toBe(1);
        expect(format.fmtSize).toBe(16);
      });
    });
  });

  it('keeps every slow recording meaningfully longer than its normal recording', () => {
    expectedAudioKeys.forEach((audioKey) => {
      const normalSeconds = readWavDurationSeconds(`public/audio/words/us/${audioKey}.wav`);
      const slowSeconds = readWavDurationSeconds(`public/audio/words/us-slow/${audioKey}.wav`);

      expect(slowSeconds, audioKey).toBeGreaterThan(normalSeconds * 1.1);
    });
  });

  it('shows the current dictation word count on the mode hub', () => {
    const modeHubSource = readFileSync(resolve(projectRoot, 'src/pages/ModeHubPage.tsx'), 'utf8');

    expect(modeHubSource).toContain('`今日 ${dictationWords.length} 词`');
    expect(modeHubSource).not.toContain('今日 8 词');
  });

  it('renders the past-tense label in dictation and daily learning', () => {
    const dictationPageSource = readFileSync(resolve(projectRoot, 'src/pages/DictationPage.tsx'), 'utf8');
    const practicePageSource = readFileSync(resolve(projectRoot, 'src/pages/PracticePage.tsx'), 'utf8');

    expect(dictationPageSource).toContain('currentStep.word.grammarLabel');
    expect(practicePageSource).toContain('question.grammarLabel');
  });
});
