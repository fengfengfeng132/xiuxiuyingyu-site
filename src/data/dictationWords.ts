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
    word: 'heavy',
    meaning: '重的',
    note: 'heavy 和 light 是一对反义词，表示东西很重。',
    imageHint: 'a child carrying a heavy schoolbag',
  },
  {
    id: 2,
    word: 'light',
    meaning: '轻的',
    note: 'light 在这里表示轻，不表示灯光。',
    imageHint: 'a child lifting a light paper box easily',
  },
  {
    id: 3,
    word: 'tall',
    meaning: '高的',
    note: '用来形容人或东西很高，比如 a tall tree。',
    imageHint: 'a tall tree beside a child',
  },
  {
    id: 4,
    word: 'short',
    meaning: '短的；矮的',
    note: 'short 可以表示长度短，也可以表示个子矮。',
    imageHint: 'a short child beside a tall child',
  },
  {
    id: 5,
    word: 'like',
    meaning: '喜欢',
    note: '表示喜欢某个人、动物或东西，比如 I like fish.',
    imageHint: 'a happy child showing that she likes something',
  },
  {
    id: 6,
    word: 'shop',
    meaning: '商店',
    note: 'shop 是卖东西的地方，比如 toy shop。',
    imageHint: 'a small shop with a sign and window display',
  },
  {
    id: 7,
    word: 'dish',
    meaning: '盘子',
    note: 'dish 常指盘子，也可以指一道菜，这里先记盘子。',
    imageHint: 'a clean dish on a dining table',
  },
  {
    id: 8,
    word: 'ship',
    meaning: '轮船',
    note: 'ship 是在水上航行的大船。',
    imageHint: 'a big ship sailing on the sea',
  },
  {
    id: 9,
    word: 'rash',
    meaning: '皮疹',
    note: 'rash 指皮肤上起的小疹子或红点。',
    imageHint: 'a child with a mild rash on the arm in a simple medical illustration',
  },
];
