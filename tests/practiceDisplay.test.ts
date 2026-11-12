import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { questionBank } from '../src/data/loadQuestionBank';
import { buildTranslationQuestion, canRevealPracticeAnswer, getPracticeCardTitle } from '../src/lib/practiceDisplay';

const question = dailyLearningQuestions[0];
const vocabularyBank = questionBank.filter((item) => item.tags.includes('vocab-qa') || item.tags.includes('vocab'));

describe('translation question display', () => {
  it('shows the Chinese meaning before submission and restores the English afterward', () => {
    const title = getPracticeCardTitle('zh2en', question, false);
    expect(title).toContain('婴儿');
    expect(title).not.toContain('baby');
    expect(getPracticeCardTitle('zh2en', question, true)).toBe('baby');
  });

  it('blocks answer audio and other clues until submission without changing other training modes', () => {
    expect(canRevealPracticeAnswer('zh2en', false)).toBe(false);
    expect(canRevealPracticeAnswer('zh2en', true)).toBe(true);
    ['normal', 'audio', 'spelling', 'weekly'].forEach((train) => expect(canRevealPracticeAnswer(train, false)).toBe(true));
  });

  it('keeps English candidates selectable and the correct answer unambiguous', () => {
    const translated = buildTranslationQuestion(question, vocabularyBank);
    expect(translated.options).toHaveLength(4);
    expect(new Set(translated.options).size).toBe(4);
    expect(translated.options[translated.answerIndex]).toBe(question.prompt);
    expect(translated.stem).toContain('婴儿');
    expect(translated.stem).not.toContain('baby');
    expect(question.options[question.answerIndex]).toBe('婴儿');
  });

  it('keeps candidates and their saved indices stable across refresh and question-flow order changes', () => {
    const initial = buildTranslationQuestion(question, vocabularyBank);
    const refreshed = buildTranslationQuestion(question, [...vocabularyBank].reverse());
    expect(refreshed.options).toEqual(initial.options);
    expect(refreshed.answerIndex).toBe(initial.answerIndex);
  });

  it('removes the complete English phrase from spelling and translation titles', () => {
    const phrase = { ...question, prompt: 'table tennis', explanation: 'table tennis 乒乓球' };
    expect(getPracticeCardTitle('spelling', phrase, false)).toBe('中文释义：乒乓球');
    expect(getPracticeCardTitle('zh2en', phrase, false)).toBe('中文释义：乒乓球');
  });
});
