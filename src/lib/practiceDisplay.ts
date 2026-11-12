import type { Question } from '../types/schema';

// The explanation is "<prompt> <meaning>"; the prompt can be a whole sentence, so it is removed as a unit.
export function getQuestionMeaning(question: Pick<Question, 'prompt' | 'explanation'>): string {
  const explanation = question.explanation.trim();
  const prompt = question.prompt.trim();
  return explanation.toLowerCase().startsWith(prompt.toLowerCase())
    ? explanation.slice(prompt.length).trim()
    : explanation;
}

export function buildTranslationQuestion(question: Question, vocabularyBank: Question[]): Question {
  const words = [...new Set(vocabularyBank.map((item) => item.prompt))].filter((word) => word !== question.prompt).sort();
  const offset = words.length > 0 ? question.id % words.length : 0;
  const distractors = [...words.slice(offset), ...words.slice(0, offset)].slice(0, 3);
  const answerIndex = question.id % (distractors.length + 1);
  const options = [...distractors];
  options.splice(answerIndex, 0, question.prompt);
  return {
    ...question,
    stem: `请选择“${getQuestionMeaning(question)}”对应的英文单词`,
    options,
    answerIndex,
  };
}

export function canRevealPracticeAnswer(train: string, hasSubmittedAnswer: boolean): boolean {
  return train !== 'zh2en' || hasSubmittedAnswer;
}

// Listening practice is answered by ear, so the phonetic stays hidden until the answer is submitted.
export function canShowPracticePhonetic(train: string, hasSubmittedAnswer: boolean): boolean {
  return canRevealPracticeAnswer(train, hasSubmittedAnswer) && (train !== 'audio' || hasSubmittedAnswer);
}

// A dialogue-fill recording contains the answer sentence; before submission only the question may be played.
export function getPracticeAudioText(
  train: string,
  question: Pick<Question, 'prompt' | 'audioText'>,
  hasSubmittedAnswer: boolean,
): string {
  if (train === 'dialogueFill' && !hasSubmittedAnswer) return question.prompt.trim();
  return (question.audioText || question.prompt || '').trim();
}

export function getPracticeCardTitle(
  train: string,
  question: Pick<Question, 'prompt' | 'explanation'>,
  hasSubmittedAnswer: boolean,
): string {
  if (train === 'audio' && !hasSubmittedAnswer) return '先点击播放，再作答';
  if (train === 'spelling' || !canRevealPracticeAnswer(train, hasSubmittedAnswer)) {
    const meaning = getQuestionMeaning(question);
    return `中文释义：${meaning || '请选择对应的英文单词'}`;
  }
  return question.prompt;
}

export type OptionRevealState = 'idle' | 'selected' | 'correct' | 'wrong';

// Before submission only the child's own pick is marked; afterwards the right answer and a wrong pick are shown instead.
export function getOptionRevealState(
  index: number,
  selectedIndex: number | null,
  answerIndex: number,
  hasSubmittedAnswer: boolean,
): OptionRevealState {
  if (!hasSubmittedAnswer) return selectedIndex === index ? 'selected' : 'idle';
  if (index === answerIndex) return 'correct';
  return selectedIndex === index ? 'wrong' : 'idle';
}

// Spelling hint: one slot per letter. Words of three letters or fewer show only the first letter,
// longer words also show the last one. "go" is "g _", never "g _ _".
export function maskSpellingWord(word: string): string {
  const chars = Array.from(word);
  if (chars.length <= 3) return chars.map((char, index) => (index === 0 ? char : '_')).join(' ');
  return chars.map((char, index) => (index === 0 || index === chars.length - 1 ? char : '_')).join(' ');
}
