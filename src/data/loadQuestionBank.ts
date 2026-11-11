import rawQuestions from './question_bank.json';
import { archivedLearningQuestions, dailyLearningQuestions } from './dailyLearningQuestions';
import { parseQuestionBank } from '../schema/questionBankSchema';

const lessonQuestions = [...archivedLearningQuestions, ...dailyLearningQuestions];
const lessonQuestionByPrompt = new Map(lessonQuestions.map((item) => [item.prompt.trim().toLowerCase(), item]));
const parsedBaseQuestionBank = parseQuestionBank(rawQuestions);

export const questionIdAliases: ReadonlyMap<number, number> = new Map(
  parsedBaseQuestionBank.flatMap((question) => {
    const replacement = lessonQuestionByPrompt.get(question.prompt.trim().toLowerCase());
    return replacement && replacement.id !== question.id ? [[question.id, replacement.id] as const] : [];
  }),
);

const baseQuestionBank = parsedBaseQuestionBank.filter(
  (item) => !lessonQuestionByPrompt.has(item.prompt.trim().toLowerCase()),
);

export const questionBank = [...baseQuestionBank, ...lessonQuestions];

export const QUESTION_TOTAL = questionBank.length || 50;
