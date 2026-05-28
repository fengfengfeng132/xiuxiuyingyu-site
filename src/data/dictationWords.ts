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
    word: 'potato chips',
    meaning: '薯片',
    note: 'potato chips 是薯片，脆脆的零食。',
    imageHint: 'a small bowl of crispy potato chips for children',
  },
  {
    id: 2,
    word: 'cupcake',
    meaning: '纸杯蛋糕',
    note: 'cupcake 是纸杯蛋糕，小小一个很可爱。',
    imageHint: 'a colorful cupcake with frosting and sprinkles',
  },
  {
    id: 3,
    word: 'balloon',
    meaning: '气球',
    note: 'balloon 是气球，会轻轻飘起来。',
    imageHint: 'a bright balloon floating in the air',
  },
  {
    id: 4,
    word: 'from',
    meaning: '从',
    note: 'from 表示从哪里来，比如 from school。',
    imageHint: 'a child walking from school with a backpack',
  },
  {
    id: 5,
    word: 'for',
    meaning: '为了/给',
    note: 'for 可以表示给谁，也可以表示为了什么。',
    imageHint: 'a child giving a gift for a friend',
  },
  {
    id: 6,
    word: 'yes',
    meaning: '是的',
    note: 'yes 表示是的，用来回答同意。',
    imageHint: 'a child smiling and saying yes with a thumbs up',
  },
  {
    id: 7,
    word: 'cube',
    meaning: '立方体',
    note: 'cube 是立方体，像小方块一样。',
    imageHint: 'a colorful cube block on a table',
  },
  {
    id: 8,
    word: 'time',
    meaning: '时间',
    note: 'time 是时间，可以看钟表知道。',
    imageHint: 'a friendly clock showing time for a child',
  },
];
