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
    word: 'laugh',
    meaning: '笑',
    note: 'laugh 表示笑，比如 laugh happily。',
    imageHint: 'a child laughing happily',
  },
  {
    id: 2,
    word: 'share',
    meaning: '分享',
    note: 'share 表示和别人一起分享东西。',
    imageHint: 'two children sharing toys',
  },
  {
    id: 3,
    word: 'help',
    meaning: '帮助',
    note: 'help 表示帮助别人，比如 help my friend。',
    imageHint: 'a child helping another child',
  },
  {
    id: 4,
    word: 'point',
    meaning: '指；指向',
    note: 'point 表示用手指向某个方向或物体。',
    imageHint: 'a child pointing at a picture on the wall',
  },
  {
    id: 5,
    word: 'who',
    meaning: '谁',
    note: 'who 用来询问“谁”，比如 Who is he?',
    imageHint: 'a child asking who with a question mark',
  },
  {
    id: 6,
    word: 'will',
    meaning: '将会',
    note: 'will 表示将来要做的事，比如 I will read。',
    imageHint: 'a child planning tomorrow activities',
  },
  {
    id: 7,
    word: 'does',
    meaning: '做（do 的第三人称单数）',
    note: 'does 常用于 he/she/it，比如 He does homework。',
    imageHint: 'a child doing homework at a desk',
  },
  {
    id: 8,
    word: 'win',
    meaning: '赢；获胜',
    note: 'win 表示赢得比赛或胜利。',
    imageHint: 'a child winning a race and raising hands',
  },
  {
    id: 9,
    word: 'rock',
    meaning: '岩石',
    note: 'rock 表示石头、岩石。',
    imageHint: 'a large gray rock on grass',
  },
  {
    id: 10,
    word: 'write',
    meaning: '写；书写',
    note: 'write 表示写字、书写，比如 write my name。',
    imageHint: 'a child writing words in a notebook with a pencil',
  },
  {
    id: 11,
    word: 'read',
    meaning: '读；阅读',
    note: 'read 表示阅读，比如 read a book。',
    imageHint: 'a child reading an English book at a desk',
  },
  {
    id: 12,
    word: 'listen',
    meaning: '听；倾听',
    note: 'listen 常搭配 to，比如 listen to the teacher。',
    imageHint: 'a child listening carefully with a hand near the ear',
  },
];
