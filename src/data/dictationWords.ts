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
    word: 'tag',
    meaning: '追人游戏',
    note: 'tag 是一种追人游戏，被碰到的人就轮到他追。',
    imageHint: 'children playing tag in a sunny playground',
  },
  {
    id: 2,
    word: 'frisbee',
    meaning: '飞盘',
    note: 'frisbee 是飞盘，可以扔给朋友接住。',
    imageHint: 'a child throwing a frisbee in a park',
  },
  {
    id: 3,
    word: 'hide-and-seek',
    meaning: '捉迷藏',
    note: 'hide-and-seek 是捉迷藏，有人藏起来，有人去找。',
    imageHint: 'children playing hide and seek behind a tree',
  },
  {
    id: 4,
    word: 'limbo',
    meaning: '林波舞',
    note: 'limbo 是一种弯腰从杆子下面钻过去的游戏。',
    imageHint: 'children bending under a low stick in a limbo game',
  },
  {
    id: 5,
    word: 'we',
    meaning: '我们',
    note: 'we 表示我们，比如 we play together。',
    imageHint: 'a group of children smiling together',
  },
  {
    id: 6,
    word: 'put',
    meaning: '放',
    note: 'put 表示放，比如 put the toy on the table。',
    imageHint: 'a child putting a toy on a table',
  },
  {
    id: 7,
    word: 'to',
    meaning: '到',
    note: 'to 表示到某个地方，比如 go to school。',
    imageHint: 'a child walking to school with a backpack',
  },
  {
    id: 8,
    word: 'king',
    meaning: '国王',
    note: 'king 表示国王，通常戴着皇冠。',
    imageHint: 'a friendly storybook king wearing a crown',
  },
  {
    id: 9,
    word: 'long',
    meaning: '长的',
    note: 'long 表示很长，比如 a long rope。',
    imageHint: 'a long rope stretched on the grass',
  },
  {
    id: 10,
    word: 'hand',
    meaning: '手',
    note: 'hand 表示手，比如 raise your hand。',
    imageHint: 'a child raising one hand in class',
  },
];
