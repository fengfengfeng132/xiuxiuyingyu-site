import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';

const expectedWords = ['full', 'empty', 'same', 'different', 'gate', 'cave', 'safe', 'heavy', 'light', 'short', 'tall'];
const expectedMeanings = ['满的', '空的', '相同的', '不同的', '大门', '山洞', '安全的', '重的', '轻的', '短的', '高的'];

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');

function readAudioWordSet(relativeDir: string): string[] {
  return readdirSync(resolve(projectRoot, relativeDir))
    .filter((name) => name.endsWith('.wav'))
    .map((name) => name.replace(/\.wav$/u, ''))
    .sort();
}

describe('daily word sync', () => {
  it('keeps the dictation word list on the requested 11-word set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 11 words in daily learning questions', () => {
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
});
