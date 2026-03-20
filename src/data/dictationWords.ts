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
    word: 'look',
    meaning: '看/瞧',
    note: '用眼睛看一看，老师常说“Look!”。',
    imageHint: 'a child looking at something with eyes',
  },
  {
    id: 2,
    word: 'mop',
    meaning: '拖把/拖地',
    note: '既可以表示拖把，也可以表示用拖把拖地。',
    imageHint: 'a floor mop for cleaning the floor',
  },
  {
    id: 3,
    word: 'sweep',
    meaning: '打扫/清扫',
    note: '常见动作是用扫帚把地扫干净。',
    imageHint: 'sweeping the floor with a broom',
  },
  {
    id: 4,
    word: 'cut',
    meaning: '切/剪',
    note: '可以是切水果，也可以是剪纸。',
    imageHint: 'cutting paper with scissors',
  },
  {
    id: 5,
    word: 'paint',
    meaning: '画画（涂色）',
    note: '用颜料或彩笔画画、涂颜色。',
    imageHint: 'painting a colorful picture',
  },
  {
    id: 6,
    word: 'with',
    meaning: '和/用/带着',
    note: '表示“和谁一起”或者“用什么东西”。',
    imageHint: 'two children together with a toy',
  },
  {
    id: 7,
    word: 'that',
    meaning: '那个',
    note: '指离自己稍远一点的东西。',
    imageHint: 'pointing to that object far away',
  },
  {
    id: 8,
    word: 'baby',
    meaning: '婴儿/宝宝',
    note: '年纪很小的小宝宝。',
    imageHint: 'a cute baby smiling',
  },
  {
    id: 9,
    word: 'bath',
    meaning: '洗澡/浴缸',
    note: '既可以表示洗澡，也可以表示浴缸。',
    imageHint: 'a bathtub ready for a bath',
  },
  {
    id: 10,
    word: 'thin',
    meaning: '瘦的/薄的',
    note: '可以形容人很瘦，也可以形容纸很薄。',
    imageHint: 'a thin book page or a thin child',
  },
];
