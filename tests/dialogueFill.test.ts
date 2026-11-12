import { describe, expect, it } from 'vitest';
import { questionBank } from '../src/data/loadQuestionBank';
import { buildDialogueFillQuestion, extractDialogueKeyword } from '../src/lib/dialogueFill';
import { hashText, stableShuffle } from '../src/lib/stableOptions';

const dialogueBank = questionBank.filter((item) => item.tags.includes('dialogue-qa') || item.tags.includes('dialogue'));
const built = dialogueBank.map((item) => buildDialogueFillQuestion(item, dialogueBank));
const byPrompt = (prompt: string) => built.find((item) => item.prompt === prompt)!;

describe('dialogue fill keyword', () => {
  it('keeps contractions typed with a curly apostrophe as one word', () => {
    expect(extractDialogueKeyword('I’m painting a picture.')).toBe('painting');
    expect(extractDialogueKeyword("I'm painting.")).toBe('painting');
    expect(extractDialogueKeyword('We strum the guitar.')).toBe('strum');
    expect(extractDialogueKeyword('He throws the ball.')).toBe('throws');
    expect(extractDialogueKeyword('Hello!')).toBe('hello');
  });
});

describe('dialogue fill questions', () => {
  it('covers every dialogue in the bank', () => {
    expect(dialogueBank).toHaveLength(11);
  });

  it.each(built.map((item) => [item.prompt, item] as const))('offers four real words with one unambiguous answer for %s', (_prompt, item) => {
    const original = dialogueBank.find((source) => source.id === item.id)!;
    const answerSentence = original.options[original.answerIndex];
    const correctWord = item.options[item.answerIndex];

    expect(item.options).toHaveLength(4);
    expect(new Set(item.options).size).toBe(4);
    item.options.forEach((option) => expect(option).toMatch(/^[a-z]{3,}$/));
    expect(answerSentence.toLowerCase().split(/\s+/)[1].replace(/[^a-z]/g, '')).toBe(correctWord);
    expect(item.stem).toContain('_____');
    expect(item.stem.replace(original.prompt, '')).not.toContain(correctWord);
  });

  it('fills the -ing word after a contraction instead of the letter m', () => {
    expect(byPrompt('What am I doing?').stem).toBe('对话填空：What am I doing? I’m _____。');
    expect(byPrompt('What am I doing?').options[byPrompt('What am I doing?').answerIndex]).toBe('painting');
    expect(byPrompt('What are you doing?').stem).toBe('对话填空：What are you doing? I’m _____ a picture。');
    expect(byPrompt('What are you doing?').options[byPrompt('What are you doing?').answerIndex]).toBe('painting');
    built.forEach((item) => expect(item.options).not.toContain('m'));
  });

  it('never offers another sentence of the same dialogue as a wrong choice', () => {
    // "I catch / hit / kick the ball." are also correct answers to "What do I do?".
    expect(byPrompt('What do I do?').options).not.toEqual(expect.arrayContaining(['hit']));
    ['What does he do?', 'What does she do?'].forEach((prompt) => {
      // "He hits the ball." is accepted, so the look-alike "hit" would be an unfair distractor.
      expect(byPrompt(prompt).options).not.toContain('hit');
    });
  });

  it('uses the other form of the same verb as the first distractor for the person-agreement dialogues', () => {
    expect(byPrompt('What do I do?').options).toContain('throws');
    expect(byPrompt('What does he do?').options).toContain('throw');
    expect(byPrompt('What does she do?').options).toContain('throw');
  });

  it('prefers verbs from the other instrument dialogues for an instrument question', () => {
    const guitar = byPrompt('How do we play the guitar?');
    expect([...guitar.options].sort()).toEqual(['blow', 'hit', 'press', 'strum']);
  });

  it('rebuilds identical options after a refresh or a different sampling order', () => {
    const again = dialogueBank.map((item) => buildDialogueFillQuestion(item, [...dialogueBank].reverse()));
    again.forEach((item) => {
      const first = built.find((source) => source.id === item.id)!;
      expect(item.options).toEqual(first.options);
      expect(item.answerIndex).toBe(first.answerIndex);
    });
  });

  it('does not mutate the source question', () => {
    const source = dialogueBank[0];
    const snapshot = structuredClone(source);
    buildDialogueFillQuestion(source, dialogueBank);
    expect(source).toEqual(snapshot);
  });
});

describe('stable option helpers', () => {
  it('shuffles deterministically without changing the input', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = stableShuffle(items, 'seed-1');
    expect(stableShuffle(items, 'seed-1')).toEqual(first);
    expect([...first].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(hashText('seed-1')).toBe(hashText('seed-1'));
    expect(hashText('seed-1')).not.toBe(hashText('seed-2'));
  });
});
