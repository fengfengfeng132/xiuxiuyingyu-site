import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dictationPageSource = readFileSync(new URL('../src/pages/DictationPage.tsx', import.meta.url), 'utf8');

describe('dictation audio routing', () => {
  it('plays daily dictation normal word audio from generated local files', () => {
    expect(dictationPageSource).toContain('playLocalUsWordAudio');
    expect(dictationPageSource).not.toContain('const playback = await playUsWordAudio(currentStep.word.word, 1);');
    expect(dictationPageSource).not.toContain('当前单词词典发音加载失败');
  });
});
