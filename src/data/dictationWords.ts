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
    word: 'Friday',
    meaning: '星期五',
    note: 'Friday 是星期五，周末快到了。',
    imageHint: 'a cheerful Friday calendar page for children',
  },
  {
    id: 2,
    word: 'Saturday',
    meaning: '星期六',
    note: 'Saturday 是星期六，很多小朋友会休息和玩耍。',
    imageHint: 'a bright Saturday calendar page for children',
  },
  {
    id: 3,
    word: 'Sunday',
    meaning: '星期日',
    note: 'Sunday 是星期日，也可以说星期天。',
    imageHint: 'a sunny Sunday calendar page for children',
  },
  {
    id: 4,
    word: 'teeth',
    meaning: '牙齿',
    note: 'teeth 是牙齿，刷牙可以保护牙齿。',
    imageHint: 'a smiling child showing clean teeth',
  },
  {
    id: 5,
    word: 'peel',
    meaning: '剥皮',
    note: 'peel 可以表示剥皮，比如剥香蕉皮。',
    imageHint: 'a child peeling a banana',
  },
  {
    id: 6,
    word: 'leaf',
    meaning: '叶子',
    note: 'leaf 是叶子，树上绿色的一片。',
    imageHint: 'a simple green leaf for children',
  },
];
