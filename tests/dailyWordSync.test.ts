import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';

const expectedWords = [
  'video games',
  'board games',
  'win',
  'lose',
  'want',
  'ring',
  'song',
  'bang',
  'them',
  'they',
  'you',
  'her',
];
const expectedMeanings = [
  '电子游戏',
  '桌游',
  '赢',
  '输',
  '想要',
  '戒指',
  '歌曲',
  '砰的一声',
  '他们/她们/它们',
  '他们/她们',
  '你/你们',
  '她/她的',
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
  it('keeps the dictation word list on the requested 12-word set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 12 words in daily learning questions', () => {
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
