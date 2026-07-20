import type { Question } from '../types/schema';
import { dictationWords } from './dictationWords';

export const DAILY_LEARNING_QUESTION_ID_BASE = 9000;

function buildOptions(wordIndex: number): { options: string[]; answerIndex: number } {
  const word = dictationWords[wordIndex];
  const distractors: string[] = [];

  for (let offset = 1; distractors.length < 3; offset += 1) {
    const candidate = dictationWords[(wordIndex + offset) % dictationWords.length].meaning;
    if (candidate !== word.meaning && !distractors.includes(candidate)) {
      distractors.push(candidate);
    }
  }

  const answerIndex = wordIndex % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, word.meaning);
  return { options, answerIndex };
}

export const dailyLearningQuestions: Question[] = dictationWords.map((word, index) => {
  const { options, answerIndex } = buildOptions(index);
  const labeledWord = word.grammarLabel ? `${word.word}（${word.grammarLabel}）` : word.word;

  return {
    id: DAILY_LEARNING_QUESTION_ID_BASE + word.id,
    level: 'L2',
    unit: 99,
    type: 'single_choice',
    prompt: word.word,
    stem: `选择与 "${labeledWord}" 对应的中文意思`,
    options,
    answerIndex,
    explanation: `${word.word} ${word.meaning}${word.grammarLabel ? `（${word.grammarLabel}）` : ''}`,
    tags: ['vocab', 'daily-dictation', 'user-custom', 'vocab-qa', ...(word.grammarLabel ? ['past-tense'] : [])],
    audioText: word.word,
    audioKey: word.audioKey,
    phonetic: word.phonetic,
    grammarLabel: word.grammarLabel,
  };
});
