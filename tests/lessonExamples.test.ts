import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { archivedDictationWords, dictationWords } from '../src/data/dictationWords';
import { parseQuestionBank } from '../src/schema/questionBankSchema';

const textbookSentences = [
  'My email address is fun54@yoohoo.com.',
  'He cleans his car in the afternoon.',
  'Please come with me.',
  'Their home has three bedrooms.',
  'She often writes funny letters to her family.',
  'She eats a sandwich for lunch every day.',
  'My parents make good pies.',
  'We need water to live.',
  'There are a lot of people here.',
  'The man starts to run.',
];

const archivedTextbookSentences = [
  'The baby cries a lot.',
  'She cleans the floor.',
  'The students eat lunch.',
  'They eat together.',
  'She enjoys art class.',
  'My family is big.',
  'She eats fruit every day.',
  'They jump into the water.',
  'There are many kinds of apples.',
  'The man laughs at the funny story.',
  'Their parents are nice.',
  'Elliot is a little elephant.',
  'He sees some tortoises.',
  'Elliot is sad.',
  'Elliot is lonely.',
  'The zebras are scared and they run away.',
  'They play together.',
  'They sleep in the bedroom.',
];

describe('textbook lesson examples', () => {
  it('keeps the ten Unit 3 Part A sentences exactly as supplied, including the textbook email address', () => {
    const examples = dictationWords.flatMap((word) => word.examples ?? []);

    expect(examples.map((example) => example.text)).toEqual(textbookSentences);
    expect(new Set(examples.map((example) => example.audioKey)).size).toBe(10);
    expect(examples.map((example) => example.audioKey)).toEqual(dictationWords.map((word) => `${word.word}-1`));
    expect(dictationWords.every((word) => word.sources?.length === 1 && word.sources[0] === 'Unit 3 · Part A')).toBe(true);
    expect(examples[0].text).toContain('fun54@yoohoo.com');
  });

  it('preserves the previous eighteen textbook sentences in the archived lesson, including both examples of eat', () => {
    const previousLesson = archivedDictationWords.filter((word) => word.id >= 101 && word.id <= 117);
    expect(previousLesson).toHaveLength(17);
    expect(previousLesson.flatMap((word) => word.examples ?? []).map((example) => example.text)).toEqual(archivedTextbookSentences);
    expect(previousLesson.filter((word) => word.word === 'eat')).toHaveLength(1);
    expect(previousLesson.find((word) => word.word === 'eat')?.sources).toEqual(['Word List', 'Unit 2']);
    expect(previousLesson.find((word) => word.word === 'eat')?.examples).toHaveLength(2);
  });

  it('provides bilingual examples and the textbook part of speech for every new word', () => {
    dictationWords.forEach((word) => {
      expect(word.examples?.length, word.word).toBeGreaterThan(0);
      expect(['n.', 'v.', 'adj.']).toContain(word.partOfSpeech);
      word.examples?.forEach((example) => {
        expect(example.translation, example.text).toMatch(/[\u4e00-\u9fff]/u);
        expect(example.audioKey).toMatch(new RegExp(`^${word.word}-[1-9]\\d*$`, 'u'));
        expect(word.sources).toContain(example.source);
      });
    });
    expect(dictationWords.find((word) => word.word === 'letter')?.partOfSpeech).toBe('n.');
    expect(dictationWords.find((word) => word.word === 'letter')?.meaning).toBe('信');
    expect(dictationWords.find((word) => word.word === 'address')?.phonetic).toBe('/əˈdres/');
  });

  it('shares each sentence, translation and audio key with regular learning', () => {
    dailyLearningQuestions.forEach((question, index) => {
      const word = dictationWords[index];
      expect(question.examples).toEqual(word.examples);
      expect(question.partOfSpeech).toBe(word.partOfSpeech);
      expect(question.sources).toEqual(word.sources);
    });
  });

  it('preserves valid example metadata when parsing a question bank', () => {
    const question = dailyLearningQuestions[0];
    expect(parseQuestionBank([question])).toEqual([question]);
  });

  it('rejects malformed example metadata at the question-bank boundary', () => {
    const question = dailyLearningQuestions[0];
    expect(parseQuestionBank([{ ...question, examples: [{ text: 'Hello.' }] }])).toEqual([]);
    expect(parseQuestionBank([{ ...question, sources: [123] }])).toEqual([]);
    expect(parseQuestionBank([{ ...question, partOfSpeech: 123 }])).toEqual([]);
  });
});
