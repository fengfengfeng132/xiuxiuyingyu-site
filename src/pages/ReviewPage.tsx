import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, startSession } from '../lib/storage';
import { WeeklyReviewEntry } from '../components/WeeklyReviewEntry';
import { getPendingReviewQuestionIds } from '../lib/reviewProgress';

export function ReviewPage() {
  const navigate = useNavigate();
  const state = loadState();
  const [now] = useState(() => Date.now());
  const questionById = new Map(questionBank.map((question) => [question.id, question]));
  const pending = state.reviewTasks
    .filter((task) => !task.completed)
    .map((task) => {
      const questions = getPendingReviewQuestionIds(task).flatMap((questionId) => {
        const question = questionById.get(questionId);
        return question ? [question] : [];
      });
      return { task, questions };
    })
    .filter(({ questions }) => questions.length > 0)
    .sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt));
  const dueNow = pending.filter(({ task }) => new Date(task.dueAt).getTime() <= now);
  const upcoming = pending.filter(({ task }) => new Date(task.dueAt).getTime() > now);

  const beginLearning = (query: string) => {
    startSession();
    navigate(`/practice?${query}`);
  };

  return (
    <main className="page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">复习任务</p>
        <h1>按到期顺序复习</h1>
        <p className="page-lead">先练到期的词。完成本轮后，答对的词会记下进度，没答对的词继续留着复习。</p>
      </section>

      <WeeklyReviewEntry bank={questionBank} state={state} onStart={() => beginLearning('mode=vocab&train=weekly')} />

      <Card className="card-tone-blue" title="自动生成复习任务">
        <div className="stats-grid stats-grid-compact">
          <div className="stat-card stat-card-white">
            <span className="stat-label">待完成任务</span>
            <strong className="stat-value">{pending.length}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">当前到期</span>
            <strong className="stat-value">{dueNow.length}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">即将到期</span>
            <strong className="stat-value">{upcoming.length}</strong>
          </div>
        </div>
      </Card>

      {dueNow.length === 0 ? (
        <Card className="card-tone-mint" title="今天没有到期任务">
          <p>{upcoming.length > 0 ? '后面的复习已经安排好，也可以先来一轮“一周再背”。' : '暂无待复习任务，也可以用“一周再背”巩固旧词。'}</p>
        </Card>
      ) : (
        dueNow.map(({ task, questions }) => (
          <Card className="card-tone-yellow" key={task.id} title={`到期时间：${new Date(task.dueAt).toLocaleString()}`}>
            <p>还需复习：{questions.length} 题</p>
            <p>
              待复习：{questions.slice(0, 3).map((question) => question.prompt).join(' / ')}
            </p>
            <Button fullWidth onClick={() => beginLearning(`mode=all&train=spaced&task=${encodeURIComponent(task.id)}`)}>
              开始复习
            </Button>
          </Card>
        ))
      )}

      {upcoming.length > 0 ? (
        <Card className="card-tone-neutral" title="即将到来的复习计划">
          {upcoming.slice(0, 6).map(({ task, questions }) => (
            <p key={task.id}>
              {new Date(task.dueAt).toLocaleDateString()}：{questions.length} 题待复习
            </p>
          ))}
        </Card>
      ) : null}
    </main>
  );
}
