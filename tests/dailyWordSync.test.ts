import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';

const expectedWords = [
  'chocolate',
  'sandwich',
  'nuts',
  'candy',
  'potato chips',
  'cupcake',
  'dive',
  'nose',
  'ride',
];
const expectedMeanings = [
  '巧克力',
  '三明治',
  '坚果',
  '糖果',
  '薯片',
  '纸杯蛋糕',
  '跳水/潜水',
  '鼻子',
  '骑/乘坐',
];

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');

function readAudioWordSet(relativeDir: string): string[] {
  return readdirSync(resolve(projectRoot, relativeDir))
    .filter((name) => name.endsWith('.wav'))
    .map((name) => name.replace(/\.wav$/u, ''))
    .sort();
}

describe('daily word sync', () => {
  it('keeps the dictation word list on the requested 9-word set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 9 words in daily learning questions', () => {
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

  it('shows the current dictation word count on the mode hub', () => {
    const modeHubSource = readFileSync(resolve(projectRoot, 'src/pages/ModeHubPage.tsx'), 'utf8');

    expect(modeHubSource).toContain('今日 9 词');
    expect(modeHubSource).not.toContain('今日 20 词');
  });
});
