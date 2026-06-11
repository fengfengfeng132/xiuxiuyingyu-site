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
    word: 'Monday',
    meaning: '星期一',
    note: 'Monday 是星期一，是一周学习的开始。',
    imageHint: 'a cheerful Monday calendar page for children',
  },
  {
    id: 2,
    word: 'Tuesday',
    meaning: '星期二',
    note: 'Tuesday 是星期二，跟在 Monday 后面。',
    imageHint: 'a friendly Tuesday calendar page for children',
  },
  {
    id: 3,
    word: 'Wednesday',
    meaning: '星期三',
    note: 'Wednesday 是星期三，在一周的中间。',
    imageHint: 'a colorful Wednesday calendar page for children',
  },
  {
    id: 4,
    word: 'Thursday',
    meaning: '星期四',
    note: 'Thursday 是星期四，离周末又近了一点。',
    imageHint: 'a bright Thursday calendar page for children',
  },
];
