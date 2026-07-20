import rawDictationWords from './dictationWords.json';

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
}

export const dictationWords: DictationWord[] = rawDictationWords;
