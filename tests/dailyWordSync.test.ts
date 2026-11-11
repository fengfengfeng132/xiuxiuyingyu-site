import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { archivedLearningQuestions, dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { archivedDictationWords, dictationWords } from '../src/data/dictationWords';
import { questionBank } from '../src/data/loadQuestionBank';
import { fetchLocalUsAudioUrl, fetchLocalUsSlowAudioUrl } from '../src/lib/phonetic';

const expectedWords = [
  'baby', 'clean', 'eat', 'enjoy', 'family', 'fruit', 'jump', 'kind', 'man', 'parent',
  'elephant', 'tortoise', 'sad', 'lonely', 'scared', 'play', 'sleep',
];
const expectedMeanings = [
  '婴儿', '清理', '吃', '喜欢', '家庭', '水果', '跳', '种类', '男人', '父亲或母亲',
  '大象', '陆龟', '难过的', '孤独的', '害怕的', '玩', '睡觉',
];
const expectedArchivedWords = [
  'am', 'is', 'are', "isn't", "aren't", 'cry', 'drive', 'funny', 'hope', 'laugh',
  'nice', 'smile', 'strong', 'student', 'young',
];
const expectedAudioKeys = [...expectedArchivedWords, ...expectedWords];

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
  it('keeps the dictation word list on the requested 17-entry set', () => {
    expect(dictationWords.map((item) => item.word)).toEqual(expectedWords);
    expect(dictationWords.map((item) => item.meaning)).toEqual(expectedMeanings);
  });

  it('reuses the same 17 entries in daily learning questions', () => {
    expect(dailyLearningQuestions).toHaveLength(expectedWords.length);
    expect(dailyLearningQuestions.map((item) => item.prompt)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.audioText)).toEqual(expectedWords);
    expect(dailyLearningQuestions.map((item) => item.audioKey ?? item.audioText)).toEqual(expectedWords);
  });

  it('keeps contraction spelling, spoken text and audio keys aligned', () => {
    ["isn't", "aren't"].forEach((word) => {
      const entry = archivedDictationWords.find((item) => item.word === word);
      expect(entry?.audioKey).toBe(word);
      expect(entry?.spokenText).toBe(word);
    });
  });

  it('gives every daily question four distinct choices and the matching answer', () => {
    dailyLearningQuestions.forEach((question, index) => {
      expect(new Set(question.options).size).toBe(4);
      expect(question.options?.[question.answerIndex ?? -1]).toBe(expectedMeanings[index]);
      expect(question.phonetic).toBe(dictationWords[index].phonetic);
    });
  });

  it('moves all previous words into regular learning without reusing their saved question IDs', () => {
    expect(archivedDictationWords.map((word) => word.word)).toEqual(expectedArchivedWords);
    expect(archivedLearningQuestions.map((question) => question.id)).toEqual(
      expectedArchivedWords.map((_, index) => 9001 + index),
    );
    expect(dailyLearningQuestions.map((question) => question.id)).toEqual(
      expectedWords.map((_, index) => 9101 + index),
    );
    archivedLearningQuestions.forEach((question) => {
      expect(question.tags).toContain('archived-dictation');
      expect(question.tags).not.toContain('daily-dictation');
      expect(questionBank.find((item) => item.id === question.id)).toEqual(question);
      expect(questionBank.filter((item) => item.prompt === question.prompt)).toHaveLength(1);
    });
    expect(new Set(questionBank.map((question) => question.id)).size).toBe(questionBank.length);
  });

  it('does not carry past-tense labels into the replacement lesson', () => {
    expect(dictationWords.some((item) => item.grammarLabel)).toBe(false);
    expect(dailyLearningQuestions.some((item) => item.grammarLabel)).toBe(false);
  });

  it('keeps normal and slow audio for both the current and archived word sets', () => {
    expect(readAudioWordSet('public/audio/words/us')).toEqual([...expectedAudioKeys].sort());
    expect(readAudioWordSet('public/audio/words/us-slow')).toEqual([...expectedAudioKeys].sort());
  });

  it('maps each current and archived word to local audio URLs that exist on disk', () => {
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
