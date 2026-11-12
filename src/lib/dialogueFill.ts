import type { Question } from '../types/schema';
import { hashText, stableShuffle } from './stableOptions';

const BLANK = '_____';
const DISTRACTOR_COUNT = 3;
const SHARED_DIALOGUE_TAGS = new Set(['dialogue', 'dialogue-qa', 'auto-generated']);

function splitWords(sentence: string): string[] {
  // iPad-style curly apostrophes belong to the word: "I’m" must not become "I" + "m".
  return sentence.replace(/[‘’]/g, "'").replace(/[^a-zA-Z']/g, ' ').split(/\s+/).filter(Boolean);
}

// The blank is always the second word of the answer sentence, e.g. "We _____ the drum."
export function extractDialogueKeyword(sentence: string): string {
  const words = splitWords(sentence);
  return (words[1] ?? words[0] ?? sentence.trim()).toLowerCase();
}

function isSameVerb(a: string, b: string): boolean {
  return a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

function answerSentence(question: Question): string {
  return question.options[question.answerIndex] ?? '';
}

// Other statements in the same dialogue ("I catch the ball.") are also right, so their verbs cannot be distractors.
function otherAcceptedKeywords(question: Question, correctWord: string): string[] {
  return (question.audioText ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !sentence.endsWith('?'))
    .map(extractDialogueKeyword)
    .filter((word) => word !== correctWord);
}

function sharedTopicTags(a: Question, b: Question): number {
  return a.tags.filter((tag) => !SHARED_DIALOGUE_TAGS.has(tag) && b.tags.includes(tag)).length;
}

export function buildDialogueFillQuestion(question: Question, dialogueBank: readonly Question[]): Question {
  const sentence = answerSentence(question);
  const correctWord = extractDialogueKeyword(sentence);
  const displayWords = sentence.replace(/[.?!]/g, '').trim().split(/\s+/).filter(Boolean);
  if (displayWords.length > 0) displayWords[displayWords.length >= 2 ? 1 : 0] = BLANK;

  const accepted = otherAcceptedKeywords(question, correctWord);
  const similarity = new Map<string, number>();
  dialogueBank.forEach((item) => {
    const word = extractDialogueKeyword(answerSentence(item));
    if (!word || word === correctWord) return;
    if (accepted.some((other) => isSameVerb(word, other)) && !isSameVerb(word, correctWord)) return;
    similarity.set(word, Math.max(similarity.get(word) ?? 0, sharedTopicTags(question, item)));
  });

  // A different form of the right verb comes first, then verbs from the most similar dialogues; the hash only breaks ties.
  const rank = (word: string) => (isSameVerb(word, correctWord) ? 100 : 0) + (similarity.get(word) ?? 0);
  const distractors = [...similarity.keys()]
    .sort((a, b) => rank(b) - rank(a) || hashText(`${question.id}:${a}`) - hashText(`${question.id}:${b}`))
    .slice(0, DISTRACTOR_COUNT);
  const options = stableShuffle([correctWord, ...distractors], `dialogue-fill:${question.id}`);

  return {
    ...question,
    stem: `对话填空：${question.prompt} ${displayWords.join(' ')}。`,
    options,
    answerIndex: options.indexOf(correctWord),
  };
}
