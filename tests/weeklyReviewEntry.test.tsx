import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyReviewEntry } from '../src/components/WeeklyReviewEntry';
import { questionBank } from '../src/data/loadQuestionBank';
import { initialState } from '../src/lib/storage';
import { ModeHubPage } from '../src/pages/ModeHubPage';
import { ReviewPage } from '../src/pages/ReviewPage';
import { WrongPage } from '../src/pages/WrongPage';
import type { AppState } from '../src/types/schema';

let state: AppState;

beforeEach(() => {
  state = { ...initialState, wrongBook: [], reviewTasks: [] };
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T12:00:00+08:00'));
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('weekly review entry', () => {
  it('shows the actual wrong-word share in the proposed round', () => {
    const bank = questionBank.filter((question) => question.tags.includes('archived-dictation'));
    state.wrongBook = bank.slice(0, 8).map((question) => ({
      questionId: question.id,
      wrongCount: 3,
      mastered: false,
      lastWrongAt: '2026-11-01T12:00:00.000Z',
    }));
    const html = renderToStaticMarkup(<WeeklyReviewEntry bank={bank} state={state} onStart={() => undefined} />);
    expect(html).toContain('本次计划 10 个词，其中 7 个错词优先复习。');
    expect(html).toContain('每轮最多 10 个词');
    expect(html).not.toContain('已掌握');
  });

  it('offers ordinary consolidation when there are no wrong words', () => {
    const html = renderToStaticMarkup(<WeeklyReviewEntry bank={questionBank} state={state} onStart={() => undefined} />);
    expect(html).toContain('旧词');
    expect(html).not.toContain('个错词优先复习');
  });

  it('disables an empty plan without inventing progress', () => {
    const html = renderToStaticMarkup(<WeeklyReviewEntry bank={[]} state={state} onStart={() => undefined} />);
    expect(html).toContain('目前没有可复习的词');
    expect(html).toContain('disabled=""');
  });

  it('adds the weekly entry alongside the existing spaced-review mode', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ModeHubPage /></MemoryRouter>);
    expect(html).toContain('一周再背');
    expect(html).toContain('间隔复习');
    expect(renderToStaticMarkup(<MemoryRouter><WrongPage /></MemoryRouter>)).toContain('开始一周复习');
  });
});

describe('review task cards', () => {
  it('previews only unfinished questions that still exist in the current bank', () => {
    state.reviewTasks = [{
      id: 'due-task',
      questionIds: [9101, 9102, 9102, 999999],
      completedQuestionIds: [9101],
      dueAt: '2026-11-11T11:00:00.000Z',
      completed: false,
    }];
    const html = renderToStaticMarkup(<MemoryRouter><ReviewPage /></MemoryRouter>);
    expect(html).toContain('还需复习：1 题');
    expect(html).toContain('待复习：clean');
    expect(html).not.toContain('baby');
    expect(html).not.toContain('999999');
    expect(html).not.toContain('标记为已完成');
    expect(html).not.toContain('题号');
    expect(html).toContain('>开始复习<');
  });

  it('leaves future tasks upcoming and offers no task-completion shortcut', () => {
    state.reviewTasks = [{
      id: 'future-task',
      questionIds: [9101, 9102],
      completedQuestionIds: [9101],
      dueAt: '2026-11-19T11:00:00.000Z',
      completed: false,
    }];
    const html = renderToStaticMarkup(<MemoryRouter><ReviewPage /></MemoryRouter>);
    expect(html).toContain('今天没有到期任务');
    expect(html).toContain('1 题待复习');
    expect(html).not.toContain('>开始复习<');
    expect(state.reviewTasks[0].completed).toBe(false);
  });
});
