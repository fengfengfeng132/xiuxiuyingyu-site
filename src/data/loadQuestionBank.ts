import rawQuestions from './question_bank.json';
import { parseQuestionBank } from '../schema/questionBankSchema';

export const questionBank = parseQuestionBank(rawQuestions);

export const QUESTION_TOTAL = questionBank.length || 50;
