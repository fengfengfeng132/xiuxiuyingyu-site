import { describe, expect, it } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { archivedDictationWords, dictationWords } from '../src/data/dictationWords';
import { parseQuestionBank } from '../src/schema/questionBankSchema';

const partASentences = [
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

const partBSentences = [
  'Dad cooks dinner for us.',
  'Which day do you have art class?',
  'What kind of juice do you want to drink?',
  'The boy stands at the front of the classroom.',
  'Nick does a great job on tests!',
  'We are able to play soccer after school today.',
  'He sees the baby smile.',
  'I send about ten emails a day.',
  'Betty has a small dog.',
  'What time is it now?',
];

describe('textbook lesson examples', () => {
  it('matches each Part B word to the printed example', () => {
    const partBWords = dictationWords.filter((word) => word.sources?.includes('Unit 3 · Part B'));
    expect(partBWords.map((word) => word.examples?.filter((example) => example.source === 'Unit 3 · Part B')
      .map((example) => example.text))).toEqual(partBSentences.map((text) => [text]));
  });

  it('keeps the pet passage sentences with their words and identifies the two supplemental examples', () => {
    const petWords = dictationWords.filter((word) => word.sources?.includes('宠物词汇'));
    const passageExamples = Object.fromEntries(petWords.map((word) => [word.word,
      word.examples?.filter((example) => example.source === '宠物词汇').map((example) => example.text),
    ]));
    expect(passageExamples).toEqual({
      play: ['We play together.'], small: ['Her kitten is small.'], hamster: [],
      goldfish: ['Those are his goldfish.'], bird: ['He has a bird.'], rabbit: [],
      lizard: ['Look at her lizard!'], kitten: ['That’s her kitten.', 'Her kitten is small.'],
    });
    const supplementalExamples = petWords.flatMap((word) => (word.examples ?? [])
      .filter((example) => example.source === '补充例句').map((example) => [word.word, example.text]));
    expect(supplementalExamples).toEqual([
      ['hamster', 'My hamster runs on its wheel.'], ['rabbit', 'My rabbit has long ears.'],
    ]);
    const small = petWords.find((word) => word.word === 'small')?.examples?.[1];
    expect(small).toMatchObject({ text: 'Her kitten is small.', audioKey: 'kitten-2' });
    expect(petWords.find((word) => word.word === 'kitten')?.examples?.[1]).toEqual(small);
  });

  it('preserves the ten archived Unit 3 Part A examples and their audio keys', () => {
    const partA = archivedDictationWords.filter((word) => word.sources?.includes('Unit 3 · Part A'));
    expect(partA.flatMap((word) => word.examples ?? []).map((example) => example.text)).toEqual(partASentences);
    expect(partA.map((word) => word.examples?.[0].audioKey)).toEqual(partA.map((word) => `${word.word}-1`));
  });

  it('keeps both lessons of play on their own sentence recordings', () => {
    const oldPlay = archivedDictationWords.find((word) => word.id === 116);
    const newPlay = dictationWords.find((word) => word.id === 306);
    expect(oldPlay?.audioKey).toBe('play');
    expect(newPlay?.audioKey).toBe('play');
    expect(oldPlay?.examples?.map((example) => example.audioKey)).toEqual(['play-1']);
    expect(newPlay?.examples?.map((example) => example.audioKey)).toEqual(['play-2', 'play-3']);
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
        expect(example.audioKey).toMatch(/^[a-z]+-[1-9]\d*$/u);
        expect([...(word.sources ?? []), '补充例句']).toContain(example.source);
      });
    });
    expect(dictationWords.find((word) => word.word === 'front')?.partOfSpeech).toBe('n.');
    expect(dictationWords.find((word) => word.word === 'cook')?.phonetic).toBe('/kʊk/');
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
