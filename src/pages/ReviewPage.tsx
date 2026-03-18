import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, saveState } from '../lib/storage';

function isDueNow(dueAt: string): boolean {
  return new Date(dueAt).getTime() <= Date.now();
}

export function ReviewPage() {
  const [tasks, setTasks] = useState(loadState().reviewTasks);

  const markDone = (id: string) => {
    const nextTasks = tasks.map((t) => (t.id === id ? { ...t, completed: true } : t));
    setTasks(nextTasks);

    const state = loadState();
    state.reviewTasks = nextTasks;
    saveState(state);
  };

  const pending = useMemo(() => tasks.filter((x) => !x.completed), [tasks]);
  const dueNow = useMemo(() => pending.filter((task) => isDueNow(task.dueAt)), [pending]);
  const upcoming = useMemo(() => pending.filter((task) => !isDueNow(task.dueAt)), [pending]);

  return (
    <main className="page">
      <h1>复习任务</h1>
      <Card title="自动生成复习任务">
        <p>待完成任务：{pending.length}</p>
        <p>当前到期：{dueNow.length}</p>
        <p>即将到期：{upcoming.length}</p>
      </Card>

      {pending.length === 0 ? (
        <Card title="今天已完成">
          <p>暂无待复习任务。</p>
        </Card>
      ) : (
        dueNow
          .slice()
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
          .map((task) => (
            <Card key={task.id} title={`到期时间：${new Date(task.dueAt).toLocaleString()}`}>
              <p>题目数量：{task.questionIds.length}</p>
              <p>题号：{task.questionIds.map((qid) => `#${qid}`).join(', ')}</p>
              <p>
                预览：
                {task.questionIds
                  .slice(0, 2)
                  .map((qid) => questionBank.find((item) => item.id === qid)?.prompt)
                  .filter(Boolean)
                  .join(' / ') || '暂无'}
              </p>
              <Button fullWidth onClick={() => markDone(task.id)}>
                标记为已完成
              </Button>
            </Card>
          ))
      )}

      {upcoming.length > 0 ? (
        <Card title="即将到来的复习计划">
          {upcoming
            .slice()
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
            .slice(0, 6)
            .map((task) => (
              <p key={task.id}>
                {new Date(task.dueAt).toLocaleDateString()}：{task.questionIds.length} 题
              </p>
            ))}
        </Card>
      ) : null}
    </main>
  );
}
