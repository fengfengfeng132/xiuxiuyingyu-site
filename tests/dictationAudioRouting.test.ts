import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dictationPageSource = readFileSync(new URL('../src/pages/DictationPage.tsx', import.meta.url), 'utf8');
const practicePageSource = readFileSync(new URL('../src/pages/PracticePage.tsx', import.meta.url), 'utf8');

describe('dictation audio routing', () => {
  it('plays daily dictation normal word audio from generated local files', () => {
    expect(dictationPageSource).toContain('playLocalUsWordAudio');
    expect(dictationPageSource).not.toContain('const playback = await playUsWordAudio(currentStep.word.word, 1);');
    expect(dictationPageSource).not.toContain('当前单词词典发音加载失败');
  });

  it('routes playback through each dictation entry audio key', () => {
    expect(dictationPageSource).toContain('currentStep.word.audioKey');
  });

  it('prioritizes daily local audio before generic and single-word routing', () => {
    const dailyRoutingIndex = practicePageSource.indexOf('const isDailyDictationWord =');
    const genericRoutingIndex = practicePageSource.indexOf('const localQuestionBankPlayback = await');
    const singleWordRoutingIndex = practicePageSource.indexOf('if (isSingleEnglishWord(text))');

    expect(dailyRoutingIndex).toBeGreaterThan(-1);
    expect(dailyRoutingIndex).toBeLessThan(genericRoutingIndex);
    expect(dailyRoutingIndex).toBeLessThan(singleWordRoutingIndex);
  });

  it('records duplicate spellings by their daily question id', () => {
    expect(dictationPageSource).toContain('DAILY_LEARNING_QUESTION_ID_BASE + word.id');
    expect(dictationPageSource).not.toContain('recordWrongWord(currentStep.word.word)');
  });
});
