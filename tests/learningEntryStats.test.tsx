import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordCompletedTraining } from '../src/lib/learningRecords';
import { createInitialState } from '../src/lib/storage';
import { HomePage } from '../src/pages/HomePage';
import { ModeHubPage } from '../src/pages/ModeHubPage';
import type { AppState } from '../src/types/schema';

let state: AppState;

beforeEach(() => {
  state = createInitialState();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 12, 12));
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('learning entry statistics', () => {
  it('shows a genuine empty state instead of demonstration progress and weak words', () => {
    const html = renderToStaticMarkup(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(html).toContain('暂无数据');
    expect(html).toContain('0天');
    expect(html).toContain('0个');
    expect(html).toContain('已练过单词');
    expect(html).toContain('错词复习0个');
    expect(html).toContain('暂无待加强错词');
    expect(html).toContain('width:0%');
    ['98%', '12天', '156个', '已掌握单词', 'finish', 'plant'].forEach((example) => expect(html).not.toContain(example));
  });

  it('shows zero daily progress without claiming an unearned level', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ModeHubPage /></MemoryRouter>);
    expect(html).toContain('0/10 分钟');
    expect(html).toContain('0/10 题');
    expect(html).toContain('今日完成 0 轮');
    expect(html).not.toContain('Lv.2');
  });

  it('uses real completed time, daily answers and distinct learned words across multiple rounds on one day', () => {
    const dailyFinished = new Date(2026, 10, 12, 9, 5).toISOString();
    state = recordCompletedTraining(state, {
      id: 'daily-round', source: 'practice', train: 'daily20', mode: 'vocab', title: '每日10题',
      startedAt: new Date(2026, 10, 12, 9).toISOString(), finishedAt: dailyFinished, questionTotal: 2,
      answers: [
        { questionId: 9001, isCorrect: true, answeredAt: dailyFinished, kind: 'practice' },
        { questionId: 9002, isCorrect: false, answeredAt: dailyFinished, kind: 'practice' },
      ],
    });
    const levelFinished = new Date(2026, 10, 12, 10, 2).toISOString();
    state = recordCompletedTraining(state, {
      id: 'level-round', source: 'practice', train: 'level10', mode: 'vocab', title: '等级10题',
      startedAt: new Date(2026, 10, 12, 10).toISOString(), finishedAt: levelFinished, questionTotal: 1,
      answers: [{ questionId: 9003, isCorrect: true, answeredAt: levelFinished, kind: 'practice' }],
    });
    const homeHtml = renderToStaticMarkup(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(homeHtml).toContain('67%');
    expect(homeHtml).toContain('1天');
    expect(homeHtml).toContain('3个');
    expect(homeHtml).toContain('width:70%');
    const hubHtml = renderToStaticMarkup(<MemoryRouter><ModeHubPage /></MemoryRouter>);
    expect(hubHtml).toContain('7/10 分钟');
    expect(hubHtml).toContain('2/10 题');
    expect(hubHtml).toContain('今日完成 1 轮');
  });
});
