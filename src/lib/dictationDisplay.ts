export type DictationStepType = 'study' | 'listenChoose' | 'listenSpell';

export interface DictationHintWord {
  word: string;
  note: string;
}

export function shouldShowDictationMeaningLine(stepType: DictationStepType, hasSubmittedAnswer: boolean): boolean {
  return stepType === 'study' || hasSubmittedAnswer;
}

export function shouldShowDictationPhoneticLine(stepType: DictationStepType, hasSubmittedAnswer: boolean): boolean {
  return stepType !== 'listenSpell' || hasSubmittedAnswer;
}

export function getDictationWordCardTitle(
  stepType: DictationStepType,
  word: string,
  hasSubmittedAnswer: boolean,
): string {
  if (stepType === 'listenSpell' && !hasSubmittedAnswer) {
    return '听音拼写';
  }

  return word;
}

export function getDictationHintText(
  stepType: DictationStepType,
  word: DictationHintWord,
  hasSubmittedAnswer: boolean,
): string {
  if (stepType === 'listenChoose' && !hasSubmittedAnswer) {
    return '听发音，选出它的意思。';
  }

  if (stepType === 'listenSpell' && !hasSubmittedAnswer) {
    return '听发音，把这个单词拼出来。';
  }

  return word.note || `提示：试着用 ${word.word} 说一个短句。`;
}
