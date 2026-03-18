import { Card } from '../components/Card';
import { questionBank } from '../data/loadQuestionBank';
import { loadState } from '../lib/storage';
import type { StudySession } from '../types/schema';

const WEEKLY_ROUND_GOAL = 5;
const WEEKLY_ACCURACY_GOAL = 80;

function getSessionTargetCount(session: StudySession, fallback: number): number {
  if (typeof session.questionTotal === 'number' && session.questionTotal > 0) {
    return Math.max(session.questionTotal, 1);
  }
  return Math.max(session.answers.length || fallback, 1);
}

function getRecentDaysDate(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

export function ParentPage() {
  const state = loadState();
  const sessions = state.sessions;

  const totalRounds = sessions.length;
  const totalQuestions = questionBank.length || 1;
  const avgScore = totalRounds ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / totalRounds) : 0;
  const bestScore = totalRounds ? Math.max(...sessions.map((s) => s.score)) : 0;
  const latest = sessions[0];

  const recent7 = sessions
    .slice(0, 7)
    .reverse()
    .map((s, idx) => {
      const target = getSessionTargetCount(s, totalQuestions);
      return {
        label: `第 ${idx + 1} 轮`,
        score: s.score,
        percent: Math.round((s.score / target) * 100),
      };
    });

  const unitTotal = questionBank.reduce<Record<number, number>>((acc, q) => {
    acc[q.unit] = (acc[q.unit] || 0) + 1;
    return acc;
  }, {});
  const unitDone = sessions.reduce<Record<number, Set<number>>>((acc, s) => {
    s.answers.forEach((a) => {
      const q = questionBank.find((item) => item.id === a.questionId);
      if (!q) return;
      if (!acc[q.unit]) acc[q.unit] = new Set<number>();
      acc[q.unit].add(q.id);
    });
    return acc;
  }, {});

  const unitProgress = Object.keys(unitTotal)
    .map((u) => Number(u))
    .sort((a, b) => a - b)
    .map((unit) => ({
      unit,
      done: unitDone[unit]?.size || 0,
      total: unitTotal[unit] || 0,
      percent: Math.round(((unitDone[unit]?.size || 0) / Math.max(unitTotal[unit] || 1, 1)) * 100),
    }));

  const weakTagMap = state.wrongBook.reduce<Record<string, number>>((acc, w) => {
    const q = questionBank.find((item) => item.id === w.questionId);
    (q?.tags || []).forEach((t) => {
      acc[t] = (acc[t] || 0) + w.wrongCount;
    });
    return acc;
  }, {});

  const weakTags = Object.entries(weakTagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalMinutes = sessions.reduce((sum, s) => {
    if (!s.finishedAt) return sum;
    const start = new Date(s.startedAt).getTime();
    const end = new Date(s.finishedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
    return sum + (end - start) / 60000;
  }, 0);

  const dayFreq = sessions.reduce<Record<string, number>>((acc, s) => {
    const day = s.startedAt.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const mastery = {
    newWords: Math.max(questionBank.length - state.wrongBook.length, 0),
    familiar: state.wrongBook.filter((x) => x.wrongCount <= 2 && !x.mastered).length,
    mastered: state.wrongBook.filter((x) => x.mastered).length,
  };

  const weeklyStart = getRecentDaysDate(7).getTime();
  const weeklySessions = sessions.filter((s) => new Date(s.startedAt).getTime() >= weeklyStart);
  const weeklyRounds = weeklySessions.length;
  const weeklyTotal = weeklySessions.reduce((sum, s) => sum + getSessionTargetCount(s, totalQuestions), 0);
  const weeklyCorrect = weeklySessions.reduce((sum, s) => sum + s.score, 0);
  const weeklyAccuracy = weeklyTotal > 0 ? Math.round((weeklyCorrect / weeklyTotal) * 100) : 0;

  const roundProgress = Math.min(Math.round((weeklyRounds / WEEKLY_ROUND_GOAL) * 100), 100);
  const accuracyProgress = Math.min(Math.round((weeklyAccuracy / WEEKLY_ACCURACY_GOAL) * 100), 100);
  const goalsReached = [weeklyRounds >= WEEKLY_ROUND_GOAL, weeklyAccuracy >= WEEKLY_ACCURACY_GOAL].filter(Boolean).length;

  const latestTotal = latest ? getSessionTargetCount(latest, totalQuestions) : totalQuestions;

  return (
    <main className="page">
      <h1>家长看板</h1>
      <Card title="总体概览">
        <p>总练习轮次：{totalRounds}</p>
        <p>平均答对题数：{avgScore}</p>
        <p>最佳答对题数：{bestScore}</p>
        <p>错题总数：{state.wrongBook.length}</p>
      </Card>

      <Card title="本周目标进度">
        <p>已达成目标：{goalsReached} / 2</p>
        <p>轮次目标：{weeklyRounds} / {WEEKLY_ROUND_GOAL}</p>
        <div className="trend-track">
          <div className="trend-fill" style={{ width: `${roundProgress}%` }} />
        </div>
        <p>正确率目标：{weeklyAccuracy}% / {WEEKLY_ACCURACY_GOAL}%</p>
        <div className="trend-track">
          <div className="trend-fill" style={{ width: `${accuracyProgress}%` }} />
        </div>
      </Card>

      <Card title="最近一轮">
        {latest ? (
          <>
            <p>完成时间：{latest.finishedAt ? new Date(latest.finishedAt).toLocaleString() : '进行中'}</p>
            <p>
              成绩：{latest.score} / {latestTotal}
            </p>
          </>
        ) : (
          <p>暂无已完成轮次。</p>
        )}
      </Card>

      <Card title="最近 7 轮趋势">
        {recent7.length === 0 ? (
          <p>暂无数据。</p>
        ) : (
          <div className="trend-list">
            {recent7.map((item) => (
              <div className="trend-item" key={item.label}>
                <div className="trend-meta">
                  <span>{item.label}</span>
                  <span>
                    {item.score}（{item.percent}%）
                  </span>
                </div>
                <div className="trend-track">
                  <div className="trend-fill" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="单元进度">
        {unitProgress.map((u) => (
          <div className="trend-item" key={`unit-${u.unit}`}>
            <div className="trend-meta">
              <span>第 {u.unit} 单元</span>
              <span>
                {u.done}/{u.total}（{u.percent}%）
              </span>
            </div>
            <div className="trend-track">
              <div className="trend-fill" style={{ width: `${u.percent}%` }} />
            </div>
          </div>
        ))}
      </Card>

      <Card title="薄弱标签（前 5）">
        {weakTags.length === 0 ? (
          <p>当前没有明显薄弱标签。</p>
        ) : (
          weakTags.map(([tag, count]) => <p key={tag}>#{tag}：{count} 次错误</p>)
        )}
      </Card>

      <Card title="掌握层级">
        <p>新词：{mastery.newWords}</p>
        <p>熟悉中：{mastery.familiar}</p>
        <p>已掌握：{mastery.mastered}</p>
      </Card>

      <Card title="学习时长与频次">
        <p>总学习时长：{Math.round(totalMinutes)} 分钟</p>
        <p>学习天数：{Object.keys(dayFreq).length}</p>
        {Object.entries(dayFreq)
          .slice(-7)
          .map(([day, count]) => (
            <p key={day}>
              {day}：{count} 轮
            </p>
          ))}
      </Card>
    </main>
  );
}
