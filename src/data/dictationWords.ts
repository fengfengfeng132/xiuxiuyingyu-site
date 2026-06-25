export interface DictationWord {
  id: number;
  word: string;
  meaning: string;
  note: string;
  imageHint: string;
}

export const dictationWords: DictationWord[] = [
  {
    id: 1,
    word: 'seven o’clock',
    meaning: '七点',
    note: 'seven o’clock 是七点，可以看钟表上的时间。',
    imageHint: 'a friendly clock showing seven o clock for children',
  },
  {
    id: 2,
    word: 'ten o’clock',
    meaning: '十点',
    note: 'ten o’clock 是十点，表示整点时间。',
    imageHint: 'a friendly clock showing ten o clock for children',
  },
  {
    id: 3,
    word: 'eight o’clock',
    meaning: '八点',
    note: 'eight o’clock 是八点，o’clock 表示整点。',
    imageHint: 'a friendly clock showing eight o clock for children',
  },
  {
    id: 4,
    word: 'eleven o’clock',
    meaning: '十一点',
    note: 'eleven o’clock 是十一点，钟表指到 11 点。',
    imageHint: 'a friendly clock showing eleven o clock for children',
  },
  {
    id: 5,
    word: 'nine o’clock',
    meaning: '九点',
    note: 'nine o’clock 是九点，是一个整点时间。',
    imageHint: 'a friendly clock showing nine o clock for children',
  },
  {
    id: 6,
    word: 'twelve o’clock',
    meaning: '十二点',
    note: 'twelve o’clock 是十二点，钟表两个针都在上面。',
    imageHint: 'a friendly clock showing twelve o clock for children',
  },
];
