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
    word: 'chocolate',
    meaning: '巧克力',
    note: 'chocolate 是巧克力，甜甜的一小块。',
    imageHint: 'a small piece of chocolate for children',
  },
  {
    id: 2,
    word: 'sandwich',
    meaning: '三明治',
    note: 'sandwich 是三明治，两片面包中间夹好吃的东西。',
    imageHint: 'a simple sandwich with bread and filling',
  },
  {
    id: 3,
    word: 'nuts',
    meaning: '坚果',
    note: 'nuts 是坚果，比如花生、杏仁这一类小零食。',
    imageHint: 'a small bowl of mixed nuts',
  },
  {
    id: 4,
    word: 'candy',
    meaning: '糖果',
    note: 'candy 是糖果，甜甜的小零食。',
    imageHint: 'colorful wrapped candy',
  },
  {
    id: 5,
    word: 'potato chips',
    meaning: '薯片',
    note: 'potato chips 是薯片，薄薄脆脆的小零食。',
    imageHint: 'a small bowl of potato chips',
  },
  {
    id: 6,
    word: 'cupcake',
    meaning: '纸杯蛋糕',
    note: 'cupcake 是纸杯蛋糕，小小一个像杯子里的蛋糕。',
    imageHint: 'a cute cupcake with frosting',
  },
  {
    id: 7,
    word: 'dive',
    meaning: '跳水/潜水',
    note: 'dive 表示跳进水里，也可以表示潜到水下。',
    imageHint: 'a child diving into a swimming pool',
  },
  {
    id: 8,
    word: 'nose',
    meaning: '鼻子',
    note: 'nose 是鼻子，可以闻到味道。',
    imageHint: 'a smiling child pointing to their nose',
  },
  {
    id: 9,
    word: 'ride',
    meaning: '骑/乘坐',
    note: 'ride 可以表示骑车，也可以表示乘坐。',
    imageHint: 'a child riding a bicycle',
  },
];
