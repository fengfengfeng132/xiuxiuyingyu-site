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
    word: 'hot',
    meaning: '热的',
    note: 'hot 表示温度高，比如 hot soup。',
    imageHint: 'a steaming bowl of hot soup on a table',
  },
  {
    id: 2,
    word: 'cold',
    meaning: '冷的',
    note: 'cold 表示温度低，比如 cold water。',
    imageHint: 'a glass of cold water with ice cubes',
  },
  {
    id: 3,
    word: 'fast',
    meaning: '快的',
    note: 'fast 表示速度快，比如 a fast train。',
    imageHint: 'a fast train moving on the tracks',
  },
  {
    id: 4,
    word: 'slow',
    meaning: '慢的',
    note: 'slow 表示速度慢，比如 a slow turtle。',
    imageHint: 'a slow turtle walking on the ground',
  },
  {
    id: 5,
    word: 'hard',
    meaning: '硬的',
    note: 'hard 表示坚硬，比如 a hard rock。',
    imageHint: 'a child touching a hard rock',
  },
  {
    id: 6,
    word: 'soft',
    meaning: '软的',
    note: 'soft 表示柔软，比如 a soft pillow。',
    imageHint: 'a soft pillow on a bed',
  },
  {
    id: 7,
    word: 'too',
    meaning: '也；太',
    note: 'too 可以表示“也”或“太”，比如 Me too。',
    imageHint: 'two children smiling and saying me too',
  },
  {
    id: 8,
    word: 'put',
    meaning: '放',
    note: 'put 表示把东西放到某个地方，比如 put the book here。',
    imageHint: 'a child putting a book on a desk',
  },
  {
    id: 9,
    word: 'but',
    meaning: '但是',
    note: 'but 表示转折，比如 I am small, but I am strong。',
    imageHint: 'a child thinking with a but speech bubble',
  },
  {
    id: 10,
    word: 'mad',
    meaning: '生气的',
    note: 'mad 表示生气的，比如 He is mad。',
    imageHint: 'a child looking mad with crossed arms',
  },
  {
    id: 11,
    word: 'cake',
    meaning: '蛋糕',
    note: 'cake 表示蛋糕，比如 a birthday cake。',
    imageHint: 'a birthday cake with candles',
  },
  {
    id: 12,
    word: 'same',
    meaning: '相同的',
    note: 'same 表示一样的，比如 the same color。',
    imageHint: 'two shirts with the same color side by side',
  },
];
