import rawDictationWords from './dictationWords.json';
import rawArchivedDictationWords from './archivedDictationWords.json';
import type { ExampleSentence } from '../types/schema';

export type { ExampleSentence } from '../types/schema';

export interface DictationWord {
  id: number;
  word: string;
  meaning: string;
  note: string;
  imageHint: string;
  phonetic: string;
  audioKey: string;
  spokenText: string;
  grammarLabel?: string;
  examples?: ExampleSentence[];
  partOfSpeech?: string;
  sources?: string[];
}

export const dictationWords: DictationWord[] = rawDictationWords;
export const archivedDictationWords: DictationWord[] = rawArchivedDictationWords;
export const vocabularyWords: DictationWord[] = [...archivedDictationWords, ...dictationWords];
