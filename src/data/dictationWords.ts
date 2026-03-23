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
    word: 'like',
    meaning: '喜欢',
    note: '表示喜欢某个人、动物或东西，比如 I like fish.',
    imageHint: 'a happy child showing that she likes something',
  },
  {
    id: 2,
    word: 'go',
    meaning: '去；走',
    note: '表示去某个地方或出发，比如 Go to school.',
    imageHint: 'a child walking and going to school',
  },
  {
    id: 3,
    word: 'says',
    meaning: '说',
    note: '是 say 的第三人称单数形式，比如 Mum says hello.',
    imageHint: 'a child speaking and saying hello',
  },
  {
    id: 4,
    word: 'long',
    meaning: '长的',
    note: '形容长度比较长，比如 a long ruler.',
    imageHint: 'a long ruler on a desk',
  },
  {
    id: 5,
    word: 'short',
    meaning: '短的；矮的',
    note: '可以形容东西短，也可以形容人个子矮。',
    imageHint: 'a short pencil beside a long pencil',
  },
  {
    id: 6,
    word: 'big',
    meaning: '大的',
    note: '形容东西大，比如 a big box.',
    imageHint: 'a big box next to a small box',
  },
  {
    id: 7,
    word: 'small',
    meaning: '小的',
    note: '和 big 相反，表示小小的东西。',
    imageHint: 'a small toy beside a big toy',
  },
  {
    id: 8,
    word: 'thick',
    meaning: '厚的',
    note: '和 thin 相反，可以形容书很厚。',
    imageHint: 'a thick book on a table',
  },
  {
    id: 9,
    word: 'thin',
    meaning: '瘦的；薄的',
    note: '和 thick 相反，可以形容人瘦或者纸很薄。',
    imageHint: 'a thin book page or a thin child',
  },
  {
    id: 10,
    word: 'shell',
    meaning: '贝壳',
    note: '海边常能捡到 shell。',
    imageHint: 'a seashell on the beach sand',
  },
  {
    id: 11,
    word: 'fish',
    meaning: '鱼',
    note: '可以指鱼这种动物，也常出现在食物语境里。',
    imageHint: 'a fish swimming in clear water',
  },
];
