import type { Question, SessionAnswer } from '../types/schema';

export function getSavedExampleReview(question: Question, answer?: SessionAnswer) {
  if (!question.examples?.length || !answer || answer.questionId !== question.id) return null;

  const wasSpellingAnswer = answer.selectedIndex < 0;
  const feedback = answer.isCorrect
    ? '这题已经答对，复习例句后继续。'
    : wasSpellingAnswer
      ? `这题已提交，原来的拼写未保存；正确拼写是 ${question.prompt}。`
      : `这题已提交，正确答案是 ${question.options[question.answerIndex]}。`;

  return {
    questionId: question.id,
    feedback,
    spellingInput: wasSpellingAnswer && answer.isCorrect ? question.prompt : '',
  };
}
