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
    word: 'video games',
    meaning: '电子游戏',
    note: 'video games 是电子游戏，可以在屏幕上玩。',
    imageHint: 'children playing colorful video games on a screen',
  },
  {
    id: 2,
    word: 'board games',
    meaning: '桌游',
    note: 'board games 是桌游，大家围在桌边一起玩。',
    imageHint: 'children playing a board game at a table',
  },
  {
    id: 3,
    word: 'win',
    meaning: '赢',
    note: 'win 表示赢了，比如比赛得了第一。',
    imageHint: 'a happy child winning a simple game',
  },
  {
    id: 4,
    word: 'lose',
    meaning: '输',
    note: 'lose 表示输了，下次还可以再试一次。',
    imageHint: 'a child learning calmly after losing a game',
  },
  {
    id: 5,
    word: 'want',
    meaning: '想要',
    note: 'want 表示想要，比如 I want a toy。',
    imageHint: 'a child pointing to a toy they want',
  },
  {
    id: 6,
    word: 'ring',
    meaning: '戒指',
    note: 'ring 是戒指，可以戴在手指上。',
    imageHint: 'a shiny ring on a small cushion',
  },
  {
    id: 7,
    word: 'song',
    meaning: '歌曲',
    note: 'song 是歌曲，可以唱出来听。',
    imageHint: 'a child singing a cheerful song with music notes',
  },
  {
    id: 8,
    word: 'bang',
    meaning: '砰的一声',
    note: 'bang 是砰的一声，比如门砰地关上。',
    imageHint: 'a comic style bang sound bubble near a closing door',
  },
  {
    id: 9,
    word: 'them',
    meaning: '他们/她们/它们',
    note: 'them 表示他们、她们或它们，是放在动作后面说的。',
    imageHint: 'a child pointing to a group of friends',
  },
  {
    id: 10,
    word: 'they',
    meaning: '他们/她们',
    note: 'they 表示他们或她们，比如 they are playing。',
    imageHint: 'a group of children playing together',
  },
  {
    id: 11,
    word: 'you',
    meaning: '你/你们',
    note: 'you 表示你或你们，比如 you are my friend。',
    imageHint: 'one child smiling and pointing kindly to a friend',
  },
  {
    id: 12,
    word: 'her',
    meaning: '她/她的',
    note: 'her 可以表示她，也可以表示她的东西。',
    imageHint: 'a girl holding her favorite book',
  },
];
