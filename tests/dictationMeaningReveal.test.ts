import { describe, expect, it } from 'vitest';
import {
  getDictationHintText,
  getDictationWordCardTitle,
  shouldShowDictationMeaningLine,
  shouldShowDictationPhoneticLine,
} from '../src/lib/dictationDisplay';

describe('dictation meaning reveal', () => {
  it('hides the meaning answer before a listen-choose question is submitted', () => {
    expect(shouldShowDictationMeaningLine('listenChoose', false)).toBe(false);
  });

  it('shows the meaning in study, and after a choose or spelling answer is submitted', () => {
    expect(shouldShowDictationMeaningLine('study', false)).toBe(true);
    expect(shouldShowDictationMeaningLine('listenChoose', true)).toBe(true);
    expect(shouldShowDictationMeaningLine('listenSpell', true)).toBe(true);
  });

  it('hides the meaning answer before a spelling question is submitted', () => {
    expect(shouldShowDictationMeaningLine('listenSpell', false)).toBe(false);
  });

  it('does not put the answer word in the main title before spelling is submitted', () => {
    expect(getDictationWordCardTitle('listenSpell', 'too', false)).toBe('听音拼写');
    expect(getDictationWordCardTitle('listenSpell', 'too', false)).not.toBe('too');
    expect(getDictationWordCardTitle('listenSpell', 'too', true)).toBe('too');
  });

  it('hides the phonetic clue before spelling is submitted', () => {
    expect(shouldShowDictationPhoneticLine('listenSpell', false)).toBe(false);
    expect(shouldShowDictationPhoneticLine('listenSpell', true)).toBe(true);
    expect(shouldShowDictationPhoneticLine('study', false)).toBe(true);
  });

  it('uses a non-answer hint before a listen-choose question is submitted', () => {
    const soft = { word: 'soft', note: 'soft 表示柔软，比如 a soft pillow。' };

    expect(getDictationHintText('listenChoose', soft, false)).toBe('听发音，选出它的意思。');
    expect(getDictationHintText('listenChoose', soft, false)).not.toContain('柔软');
  });

  it('uses a non-answer hint before a spelling question is submitted', () => {
    const too = { word: 'too', note: 'too 可以表示“也”或“太”，比如 Me too。' };

    expect(getDictationHintText('listenSpell', too, false)).toBe('听发音，把这个单词拼出来。');
    expect(getDictationHintText('listenSpell', too, false)).not.toContain('too');
    expect(getDictationHintText('listenSpell', too, false)).not.toContain('也');
  });

  it('keeps the word note for study and after a listen-choose answer is submitted', () => {
    const soft = { word: 'soft', note: 'soft 表示柔软，比如 a soft pillow。' };

    expect(getDictationHintText('study', soft, false)).toBe(soft.note);
    expect(getDictationHintText('listenChoose', soft, true)).toBe(soft.note);
  });
});
