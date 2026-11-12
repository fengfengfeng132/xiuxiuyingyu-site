import type { Question } from '../types/schema';

function getQuestionMeaning(question: Pick<Question, 'prompt' | 'explanation'>): string {
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

export function getPracticeCardTitle(
  train: string,
  question: Pick<Question, 'prompt' | 'explanation'>,
  hasSubmittedAnswer: boolean,
): string {
  if (train === 'audio') return '先点击播放，再作答';
  if (train === 'spelling' || !canRevealPracticeAnswer(train, hasSubmittedAnswer)) {
    const meaning = getQuestionMeaning(question);
    return `中文释义：${meaning || '请选择对应的英文单词'}`;
  }
  return question.prompt;
}
