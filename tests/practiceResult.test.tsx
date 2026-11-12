import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyLearningQuestions } from '../src/data/dailyLearningQuestions';
import { initialState } from '../src/lib/storage';
import { ResultPage } from '../src/pages/ResultPage';

afterEach(() => vi.unstubAllGlobals());

describe('practice result answer', () => {
  it('uses the correct English word when reviewing a failed translation question', () => {
    const question = dailyLearningQuestions[0];
    const state = {
      ...initialState,
      sessions: [{
        id: 'translation-round',
        train: 'zh2en',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T10:01:00.000Z',
        currentQuestionIndex: 0,
        questionTotal: 1,
        answers: [{ questionId: question.id, selectedIndex: 1, isCorrect: false, answeredAt: '2026-11-12T10:01:00.000Z' }],
        score: 0,
        accuracy: 0,
      }],
    };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
    const html = renderToStaticMarkup(<MemoryRouter><ResultPage /></MemoryRouter>);
    expect(html).toContain('baby → 英文. baby');
    expect(html).not.toContain('baby → A. 婴儿');
  });

  function renderResult(session: Record<string, unknown>, reviewTasks: unknown[] = []) {
    const question = dailyLearningQuestions[0];
    const state = {
      ...initialState,
      reviewTasks,
      sessions: [{
        id: 'finished-round',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T10:01:00.000Z',
        currentQuestionIndex: 0,
        questionTotal: 1,
        answers: [{ questionId: question.id, selectedIndex: question.answerIndex, isCorrect: true, answeredAt: '2026-11-12T10:01:00.000Z' }],
        score: 1,
        accuracy: 1,
        ...session,
      }],
    };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
    return renderToStaticMarkup(<MemoryRouter><ResultPage /></MemoryRouter>);
  }

  it('repeats the same kind of round from the result page', () => {
    expect(renderResult({ mode: 'vocab', train: 'spelling' })).toContain('href="/practice?mode=vocab&amp;train=spelling"');
    expect(renderResult({ mode: 'all', train: 'audio' })).toContain('href="/practice?mode=all&amp;train=audio"');
    expect(renderResult({})).toContain('href="/practice"');
  });

  it('reopens a review task only while it still has words left', () => {
    const task = { id: 'due-task', questionIds: [9101, 9102], completedQuestionIds: [9101], dueAt: '2026-11-11T11:00:00.000Z', completed: false };
    const session = { mode: 'all', train: 'spaced', reviewTaskId: 'due-task' };
    expect(renderResult(session, [task])).toContain('href="/practice?mode=all&amp;train=spaced&amp;task=due-task"');
    expect(renderResult(session, [{ ...task, completedQuestionIds: [9101, 9102], completed: true }])).toContain('href="/practice?mode=all&amp;train=spaced"');
    expect(renderResult(session, [])).toContain('href="/practice?mode=all&amp;train=spaced"');
  });
});
