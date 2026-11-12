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
});
