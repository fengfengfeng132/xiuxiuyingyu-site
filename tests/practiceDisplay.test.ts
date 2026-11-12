import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { questionBank } from '../src/data/loadQuestionBank';
import {
  buildTranslationQuestion,
  canRevealPracticeAnswer,
  canShowPracticePhonetic,
  getOptionRevealState,
  getPracticeAudioText,
  getPracticeCardTitle,
  getQuestionMeaning,
  maskSpellingWord,
} from '../src/lib/practiceDisplay';

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

describe('listening and dialogue practice display', () => {
  it('keeps the word and its phonetic hidden in listening practice until the answer is submitted', () => {
    expect(getPracticeCardTitle('audio', question, false)).toBe('先点击播放，再作答');
    expect(getPracticeCardTitle('audio', question, true)).toBe('baby');
    expect(canShowPracticePhonetic('audio', false)).toBe(false);
    expect(canShowPracticePhonetic('audio', true)).toBe(true);
  });

  it('follows the existing reveal rule for the phonetic in every other mode', () => {
    expect(canShowPracticePhonetic('zh2en', false)).toBe(false);
    expect(canShowPracticePhonetic('zh2en', true)).toBe(true);
    ['normal', 'spelling', 'weekly', 'today10'].forEach((train) => expect(canShowPracticePhonetic(train, false)).toBe(true));
  });

  it('plays only the question of a dialogue-fill item before it is answered', () => {
    const dialogue = questionBank.find((item) => item.prompt === 'How do we play the trumpet?')!;
    expect(getPracticeAudioText('dialogueFill', dialogue, false)).toBe('How do we play the trumpet?');
    expect(getPracticeAudioText('dialogueFill', dialogue, true)).toBe('How do we play the trumpet? We blow the trumpet.');
    expect(getPracticeAudioText('normal', dialogue, false)).toBe('How do we play the trumpet? We blow the trumpet.');
    expect(getPracticeAudioText('normal', { prompt: ' baby ', audioText: undefined }, false)).toBe('baby');
  });

  it('marks only the own pick before submission and the right answer afterwards', () => {
    expect([0, 1, 2, 3].map((index) => getOptionRevealState(index, 2, 1, false))).toEqual(['idle', 'idle', 'selected', 'idle']);
    expect([0, 1, 2, 3].map((index) => getOptionRevealState(index, 2, 1, true))).toEqual(['idle', 'correct', 'wrong', 'idle']);
    expect([0, 1, 2, 3].map((index) => getOptionRevealState(index, 1, 1, true))).toEqual(['idle', 'correct', 'idle', 'idle']);
    expect([0, 1, 2, 3].map((index) => getOptionRevealState(index, null, 1, true))).toEqual(['idle', 'correct', 'idle', 'idle']);
  });
});

describe('spelling hint and meaning text', () => {
  it('shows exactly one slot per letter in the spelling hint', () => {
    expect(maskSpellingWord('go')).toBe('g _');
    expect(maskSpellingWord('ox')).toBe('o _');
    expect(maskSpellingWord('cat')).toBe('c _ _');
    expect(maskSpellingWord('baby')).toBe('b _ _ y');
    expect(maskSpellingWord('elephant')).toBe('e _ _ _ _ _ _ t');
    questionBank.filter((item) => /^[A-Za-z]+$/.test(item.prompt)).forEach((item) => {
      expect(maskSpellingWord(item.prompt).split(' ')).toHaveLength(item.prompt.length);
    });
  });

  it('shows apostrophes, hyphens and spaces instead of counting them as letters', () => {
    expect(maskSpellingWord("isn't")).toBe("i _ _ ' t");
    expect(maskSpellingWord('aren’t')).toBe('a _ _ _ ’ t');
    expect(maskSpellingWord('hide-and-seek')).toBe('h _ _ _ - _ _ _ - _ _ _ k');
    expect(maskSpellingWord('table tennis')).toBe('t _ _ _ _   _ _ _ _ _ s');

    vocabularyBank.forEach((item) => {
      const letters = Array.from(item.prompt).filter((char) => /\p{L}/u.test(char)).length;
      const hint = maskSpellingWord(item.prompt);
      const blanks = hint.split('_').length - 1;
      expect(blanks, item.prompt).toBe(letters - (letters > 3 ? 2 : 1));
      Array.from(item.prompt).filter((char) => !/\p{L}/u.test(char)).forEach((char) => expect(hint).toContain(char));
    });
  });

  it('removes the whole prompt from the explanation, including sentence prompts', () => {
    expect(getQuestionMeaning({ prompt: 'baby', explanation: 'baby 婴儿' })).toBe('婴儿');
    expect(getQuestionMeaning({ prompt: 'table tennis', explanation: 'table tennis 乒乓球' })).toBe('乒乓球');
    expect(getQuestionMeaning({
      prompt: 'How do we play the guitar?',
      explanation: 'How do we play the guitar? We strum the guitar.',
    })).toBe('We strum the guitar.');
  });
});
