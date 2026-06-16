import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { dictationWords } from '../src/data/dictationWords';
import { fetchLocalUsAudioUrl, fetchLocalUsSlowAudioUrl } from '../src/lib/phonetic';

const expectedWords = ['Friday', 'Saturday', 'Sunday', 'teeth', 'peel', 'leaf'];
const expectedMeanings = ['星期五', '星期六', '星期日', '牙齿', '剥皮', '叶子'];

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

describe('daily word sync', () => {
  it('keeps the dictation word list on the requested 6-word set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 6 words in daily learning questions', () => {
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

  it('shows the current dictation word count on the mode hub', () => {
    const modeHubSource = readFileSync(resolve(projectRoot, 'src/pages/ModeHubPage.tsx'), 'utf8');

    expect(modeHubSource).toContain('今日 6 词');
    expect(modeHubSource).not.toContain('今日 20 词');
  });
});
