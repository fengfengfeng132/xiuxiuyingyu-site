import rawQuestions from './question_bank.json';
import { dailyLearningQuestions } from './dailyLearningQuestions';
import { parseQuestionBank } from '../schema/questionBankSchema';

const dailyWordPromptSet = new Set(dailyLearningQuestions.map((item) => item.prompt.trim().toLowerCase()));
const baseQuestionBank = parseQuestionBank(rawQuestions).filter(
  (item) => !dailyWordPromptSet.has(item.prompt.trim().toLowerCase()),
);

export const questionBank = [...baseQuestionBank, ...dailyLearningQuestions];

export const QUESTION_TOTAL = questionBank.length || 50;
