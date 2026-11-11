import type { Question } from '../types/schema';
import { archivedDictationWords, dictationWords, type DictationWord } from './dictationWords';

export const DAILY_LEARNING_QUESTION_ID_BASE = 9000;

function buildOptions(words: DictationWord[], wordIndex: number): { options: string[]; answerIndex: number } {
  const word = words[wordIndex];
  const distractors: string[] = [];

  for (let offset = 1; offset < words.length && distractors.length < 3; offset += 1) {
    const candidate = words[(wordIndex + offset) % words.length].meaning;
    if (candidate !== word.meaning && !distractors.includes(candidate)) {
      distractors.push(candidate);
    }
  }

  if (distractors.length < 3) {
    throw new Error(`Word lesson needs at least four distinct meanings: ${word.word}`);
  }

  const answerIndex = wordIndex % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, word.meaning);
  return { options, answerIndex };
}

function buildLearningQuestions(words: DictationWord[], lessonTag: string): Question[] {
  return words.map((word, index) => {
    const { options, answerIndex } = buildOptions(words, index);
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
      tags: ['vocab', lessonTag, 'user-custom', 'vocab-qa', ...(word.grammarLabel ? ['past-tense'] : [])],
      audioText: word.word,
      audioKey: word.audioKey,
      phonetic: word.phonetic,
      grammarLabel: word.grammarLabel,
      examples: word.examples,
      partOfSpeech: word.partOfSpeech,
      sources: word.sources,
    };
  });
}

export const dailyLearningQuestions = buildLearningQuestions(dictationWords, 'daily-dictation');
export const archivedLearningQuestions = buildLearningQuestions(archivedDictationWords, 'archived-dictation');
