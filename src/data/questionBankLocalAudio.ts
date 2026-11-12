import { vocabularyWords } from './dictationWords';
import { questionBank } from './loadQuestionBank';

export interface QuestionBankLocalAudioEntry {
  text: string;
  normal: string;
  slow: string;
}

const FILE_SLUG_LIMIT = 56;
const SINGLE_WORD_SLUG_LIMIT = 48;
const HASH_OFFSET_BASIS = 2166136261;
const HASH_PRIME = 16777619;

function normalizeAudioText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function audioFileKey(text: string): string {
  const normalized = normalizeAudioText(text);
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (/^[a-z]+(?:-[a-z]+)*$/.test(normalized) && slug.length <= SINGLE_WORD_SLUG_LIMIT) return slug;

  let hash = HASH_OFFSET_BASIS;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = Math.imul(hash ^ normalized.charCodeAt(index), HASH_PRIME);
  }
  const digest = (hash >>> 0).toString(16).padStart(8, '0');
  return `${slug.slice(0, FILE_SLUG_LIMIT).replace(/-$/g, '') || 'audio'}-${digest}`;
}

const vocabularyAudioKeys = new Set(vocabularyWords.map((word) => normalizeAudioText(word.audioKey)));
const audioTexts = new Map<string, string>();
for (const question of questionBank) {
  const text = (question.audioText || question.prompt).trim().replace(/\s+/g, ' ');
  // The same source covers full playback and the page's sentence repeat control.
  for (const candidate of [text, ...text.split(/(?<=[.!?])\s+/)]) {
    const key = normalizeAudioText(candidate);
    if (key && !vocabularyAudioKeys.has(key) && !audioTexts.has(key)) audioTexts.set(key, candidate);
  }
}

export const questionBankLocalAudioEntries: QuestionBankLocalAudioEntry[] = [...audioTexts.values()].map((text) => {
  const key = audioFileKey(text);
  return {
    text,
    normal: `/audio/question-bank/us/${key}.wav`,
    slow: `/audio/question-bank/us-slow/${key}.wav`,
  };
});
