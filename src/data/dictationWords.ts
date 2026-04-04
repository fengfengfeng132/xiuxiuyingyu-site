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
    word: 'read',
    meaning: '读；阅读',
    note: '可以表示读书、读文章，比如 read a book。',
    imageHint: 'a child reading an English book at a desk',
  },
  {
    id: 2,
    word: 'write',
    meaning: '写；书写',
    note: '表示写字、写句子，比如 write my name。',
    imageHint: 'a child writing words in a notebook with a pencil',
  },
  {
    id: 3,
    word: 'listen',
    meaning: '听；倾听',
    note: 'listen 常搭配 to，比如 listen to the teacher。',
    imageHint: 'a child listening carefully with a hand near the ear',
  },
  {
    id: 4,
    word: 'talk',
    meaning: '说话；交谈',
    note: 'talk 表示说话、聊天，比如 talk with friends。',
    imageHint: 'two children talking to each other in class',
  },
  {
    id: 5,
    word: 'duck',
    meaning: '鸭子',
    note: 'duck 是常见动物名词，发音注意短元音 /ʌ/。',
    imageHint: 'a yellow duck standing near a pond',
  },
  {
    id: 6,
    word: 'thick',
    meaning: '厚的',
    note: 'thick 和 thin 相对，表示厚、粗。',
    imageHint: 'a thick book next to a thin book',
  },
  {
    id: 7,
    word: 'rock',
    meaning: '岩石',
    note: 'rock 可表示石头、岩石。',
    imageHint: 'a large gray rock on grass',
  },
  {
    id: 8,
    word: 'pink',
    meaning: '粉色（的）',
    note: 'pink 可作颜色名词，也可作形容词。',
    imageHint: 'pink school supplies on a table',
  },
  {
    id: 9,
    word: 'neck',
    meaning: '脖子',
    note: 'neck 是身体部位，注意和 back 区分。',
    imageHint: 'a child pointing to the neck',
  },
  {
    id: 10,
    word: 'think',
    meaning: '思考；想',
    note: 'think 表示思考、认为，比如 I think so。',
    imageHint: 'a child thinking with a question bubble',
  },
];
