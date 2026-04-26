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
    word: 'full',
    meaning: '满的',
    note: 'full 表示装满了，比如 a full cup。',
    imageHint: 'a cup full of milk on a table',
  },
  {
    id: 2,
    word: 'empty',
    meaning: '空的',
    note: 'empty 表示里面没有东西，比如 an empty box。',
    imageHint: 'an empty toy box with the lid open',
  },
  {
    id: 3,
    word: 'same',
    meaning: '相同的',
    note: 'same 表示一样的，比如 the same color。',
    imageHint: 'two balloons with the same red color side by side',
  },
  {
    id: 4,
    word: 'different',
    meaning: '不同的',
    note: 'different 表示不一样，比如 different colors。',
    imageHint: 'two shirts with different colors on a clothesline',
  },
  {
    id: 5,
    word: 'gate',
    meaning: '大门',
    note: 'gate 表示大门，比如 a school gate。',
    imageHint: 'a child standing next to a school gate',
  },
  {
    id: 6,
    word: 'cave',
    meaning: '山洞',
    note: 'cave 表示山洞，比如 a cave in the mountain。',
    imageHint: 'the opening of a cave in a mountain with soft daylight',
  },
  {
    id: 7,
    word: 'safe',
    meaning: '安全的',
    note: 'safe 表示很安全，比如 a safe seat belt。',
    imageHint: 'a child wearing a seat belt safely in a car',
  },
  {
    id: 8,
    word: 'heavy',
    meaning: '重的',
    note: 'heavy 表示很重，比如 a heavy school bag。',
    imageHint: 'a child trying to lift a heavy school bag',
  },
  {
    id: 9,
    word: 'light',
    meaning: '轻的',
    note: 'light 在这里表示重量轻，比如 a light bag。',
    imageHint: 'a child smiling while carrying a light bag easily',
  },
  {
    id: 10,
    word: 'short',
    meaning: '短的',
    note: 'short 表示短的，比如 a short pencil。',
    imageHint: 'a short pencil next to a long pencil',
  },
  {
    id: 11,
    word: 'tall',
    meaning: '高的',
    note: 'tall 表示很高，比如 a tall tree。',
    imageHint: 'a tall tree beside a small child',
  },
];
