import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const target = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(target.pathname) && existsSync(`${fileURLToPath(target)}.ts`)) {
        return nextResolve(`${target.href}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { questionBank } = await import('../src/data/loadQuestionBank.ts');
const { dictationWords } = await import('../src/data/dictationWords.ts');
const { selectReviewQuestions } = await import('../src/lib/reviewSelection.ts');
const { recordCompletedTraining } = await import('../src/lib/learningRecords.ts');
const { getLearningStatistics } = await import('../src/lib/learningStats.ts');
const { updateWrongBookForQuestion } = await import('../src/lib/studyFeedback.ts');
const { createInitialState, loadState, saveState, resetState, APP_STORAGE_KEY } = await import('../src/lib/storage.ts');

// Only this Node process uses the fixture store; browser and production records are never accessed.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

const now = new Date('2026-11-12T12:00:00+08:00');
const dailyBank = questionBank.filter((question) => question.tags.includes('daily-dictation'));
assert.equal(dailyBank.length, 17);
assert.equal(dailyBank.length, dictationWords.length);
const dictationStartedAt = now.getTime() - 10 * 60_000;
const answers = dailyBank.flatMap((question, index) => ['meaning', 'spelling'].map((kind, part) => ({
  questionId: question.id, kind, isCorrect: true,
  answeredAt: new Date(dictationStartedAt + (index * 2 + part + 1) * 1000).toISOString(),
})));
const dictationInput = {
  id: 'perfect-dictation', source: 'dictation', title: '每日听写', train: 'dictation', mode: 'vocab',
  startedAt: new Date(dictationStartedAt).toISOString(), finishedAt: now.toISOString(),
  questionTotal: answers.length, answers,
};
const dueState = createInitialState();
dueState.reviewTasks = [{
  id: 'due-daily-words', questionIds: dailyBank.map((question) => question.id),
  dueAt: '2026-11-11T19:00:00+08:00', completed: false,
}];
const perfectState = recordCompletedTraining(dueState, dictationInput);
assert.equal(recordCompletedTraining(perfectState, dictationInput), perfectState);
saveState(perfectState);
const restoredPerfectState = loadState();
const weeklyAfterPerfectDictation = selectReviewQuestions(dailyBank, restoredPerfectState, { kind: 'weekly', now, count: dailyBank.length });
const stats = getLearningStatistics(restoredPerfectState, questionBank, now);
assert.equal(answers.length, 34);
assert.deepEqual(new Set(weeklyAfterPerfectDictation.map((question) => question.id)), new Set(dailyBank.map((question) => question.id)));
assert.equal(restoredPerfectState.reviewTasks[0].completed, true);
assert.equal(restoredPerfectState.starRecords.length, 1);
assert.equal(restoredPerfectState.learningRecords.rounds[0].correctCount, 34);
assert.equal(stats.totalRounds, 1);
assert.equal(stats.learnedWordCount, 17);

const keyboard = questionBank.find((question) => question.prompt === 'keyboard');
assert.ok(keyboard && !keyboard.tags.includes('archived-dictation'));
function practiceInput(id, questionId, at) {
  return {
    id, source: 'practice', title: '标准训练', train: 'normal', mode: 'vocab', questionTotal: 1,
    startedAt: new Date(at - 60_000).toISOString(), finishedAt: new Date(at).toISOString(),
    answers: [{ questionId, kind: 'practice', isCorrect: true, answeredAt: new Date(at).toISOString() }],
  };
}

// The retained session list is only a fixture for the 30-round display cap, not completion logic.
function displaySession(input) {
  return {
    id: input.id, mode: input.mode, train: input.train, startedAt: input.startedAt, finishedAt: input.finishedAt,
    currentQuestionIndex: 1, questionIds: input.answers.map((answer) => answer.questionId),
    score: 1, accuracy: 1, questionTotal: input.questionTotal,
    answers: input.answers.map((answer) => ({ ...answer, selectedIndex: 0 })),
  };
}

const firstPractice = practiceInput('keyboard-learned', keyboard.id, now.getTime() - 5 * 86_400_000);
let historyState = recordCompletedTraining(createInitialState(), firstPractice);
historyState = { ...historyState, sessions: [displaySession(firstPractice)] };
const beforeRetention = selectReviewQuestions([keyboard], historyState, { kind: 'weekly', now }).length;
for (let index = 0; index < 30; index += 1) {
  const input = practiceInput(`later-${index}`, dailyBank[0].id, now.getTime() - 3_600_000 + index * 60_000);
  historyState = recordCompletedTraining(historyState, input);
  historyState = { ...historyState, sessions: [displaySession(input), ...historyState.sessions].slice(0, 30) };
}
saveState(historyState);
historyState = loadState();
const afterRetention = selectReviewQuestions([keyboard], historyState, { kind: 'weekly', now }).length;
assert.equal(beforeRetention, 1);
assert.equal(afterRetention, 1);
assert.equal(historyState.sessions.length, 30);
assert.equal(historyState.sessions.some((session) => session.id === firstPractice.id), false);
assert.equal(historyState.learningRecords.rounds.length, 31);

resetState();
const firstUse = loadState();
const feedback = updateWrongBookForQuestion(firstUse.wrongBook, firstUse.reviewTasks, dailyBank[0].id, now);
firstUse.wrongBook = feedback.wrongBook;
firstUse.reviewTasks = feedback.reviewTasks;
assert.equal(firstUse.wrongBook.length, 1);
assert.equal(firstUse.reviewTasks.length, 4);
saveState(firstUse);
resetState();
const afterReset = loadState();
const keyRemovedAtReset = !memory.has(APP_STORAGE_KEY);
assert.equal(keyRemovedAtReset, true);
assert.notEqual(afterReset, firstUse);
assert.equal(afterReset.wrongBook.length, 0);
assert.equal(afterReset.reviewTasks.length, 0);
saveState(afterReset);
assert.equal(loadState().wrongBook.length, 0);
assert.equal(loadState().reviewTasks.length, 0);

console.log(JSON.stringify({
  ok: true,
  perfectDictation: {
    correctAttempts: answers.length, weeklyEligibleCurrentWords: weeklyAfterPerfectDictation.length,
    dueTaskCompleted: restoredPerfectState.reviewTasks[0].completed, stars: restoredPerfectState.starRecords.length,
    recordedRounds: stats.totalRounds, learnedWords: stats.learnedWordCount,
  },
  longTermEligibility: {
    word: keyboard.prompt, beforeRetention, afterRetention,
    retainedDisplaySessions: historyState.sessions.length, recordedRounds: historyState.learningRecords.rounds.length,
  },
  reset: { keyRemovedAtReset, remainingWrongWords: afterReset.wrongBook.length, remainingTasks: afterReset.reviewTasks.length },
}));
