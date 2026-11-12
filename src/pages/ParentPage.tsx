import { Card } from '../components/Card';
import { questionBank } from '../data/loadQuestionBank';
import { loadState } from '../lib/storage';
import { getLearningStatistics, getTrainingAccuracy } from '../lib/learningStats';

const WEEKLY_ROUND_GOAL = 5;
const WEEKLY_ACCURACY_GOAL = 80;

export function ParentPage() {
  const state = loadState();
  const statistics = getLearningStatistics(state, questionBank);
  const { latest, unitProgress, weakTags, mastery, dayFrequency } = statistics;
  const recent7 = statistics.recentRounds.slice().reverse().map((round, index) => ({
    label: `第 ${index + 1} 轮 · ${round.title}`,
    score: round.correctCount,
    percent: getTrainingAccuracy(round),
  }));
  const weeklyAccuracy = statistics.weeklyAccuracy;
  const roundProgress = Math.min(Math.round((statistics.weeklyRounds / WEEKLY_ROUND_GOAL) * 100), 100);
  const accuracyProgress = Math.min(Math.round(((weeklyAccuracy ?? 0) / WEEKLY_ACCURACY_GOAL) * 100), 100);
  const goalsReached = [statistics.weeklyRounds >= WEEKLY_ROUND_GOAL, (weeklyAccuracy ?? 0) >= WEEKLY_ACCURACY_GOAL].filter(Boolean).length;
  const overviewStats = [
    { label: '已完成训练轮次', value: statistics.totalRounds },
    { label: '已记录正确率', value: statistics.accuracy === null ? '暂无数据' : `${statistics.accuracy}%` },
    { label: '已记录作答次数', value: statistics.totalAnswered },
    { label: '已练过单词', value: statistics.learnedWordCount },
  ];
  return (
    <main className="page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">家长看板</p>
        <h1>学习走势一眼看懂</h1>
        <p className="page-lead">把轮次、正确率、薄弱点和学习时长放到同一页里，方便家长快速判断最近节奏。</p>
      </section>

      <Card className="card-tone-blue" title="总体概览">
        <div className="stats-grid">
          {overviewStats.map((item) => (
            <div key={item.label} className="stat-card stat-card-white">
              <span className="stat-label">{item.label}</span>
              <strong className="stat-value">{item.value}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="card-tone-mint" title="本周目标进度">
        <p>已达成目标：{goalsReached} / 2</p>
        <p>轮次目标：{statistics.weeklyRounds} / {WEEKLY_ROUND_GOAL}</p>
        <div className="trend-track">
          <div className="trend-fill" style={{ width: `${roundProgress}%` }} />
        </div>
        <p>正确率目标：{weeklyAccuracy === null ? '暂无数据' : `${weeklyAccuracy}%`} / {WEEKLY_ACCURACY_GOAL}%</p>
        <div className="trend-track">
          <div className="trend-fill" style={{ width: `${accuracyProgress}%` }} />
        </div>
      </Card>

      <Card className="card-tone-neutral" title="最近一轮">
        {latest ? (
          <>
            <p>{latest.title} · {new Date(latest.finishedAt).toLocaleString()}</p>
            <p>
              {latest.totalsKnown ? `成绩：${latest.correctCount} / ${latest.questionTotal}` : `已记录 ${latest.answeredCount} 次作答，暂无完整成绩。`}
            </p>
          </>
        ) : (
          <p>暂无已完成轮次。</p>
        )}
      </Card>

      <Card className="card-tone-neutral" title="最近 7 轮趋势">
        {recent7.length === 0 ? (
          <p>暂无数据。</p>
        ) : (
          <div className="trend-list">
            {recent7.map((item) => (
              <div className="trend-item" key={item.label}>
                <div className="trend-meta">
                  <span>{item.label}</span>
                  <span>
                    {item.percent === null ? '暂无完整成绩' : `${item.score}（${item.percent}%）`}
                  </span>
                </div>
                <div className="trend-track">
                  <div className="trend-fill" style={{ width: `${item.percent ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="card-tone-yellow" title="单元进度">
        {unitProgress.map((u) => (
          <div className="trend-item" key={`unit-${u.unit}`}>
            <div className="trend-meta">
              <span>{u.unit === 99 ? '日常词汇' : `第 ${u.unit} 单元`}</span>
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

      <Card className="card-tone-coral" title="薄弱标签（前 5）">
        {weakTags.length === 0 ? (
          <p>当前没有明显薄弱标签。</p>
        ) : (
          weakTags.map(([tag, count]) => <p key={tag}>#{tag}：{count} 次错误</p>)
        )}
      </Card>

      <Card className="card-tone-neutral" title="掌握层级">
        <div className="stats-grid stats-grid-compact">
          <div className="stat-card stat-card-white">
            <span className="stat-label">未练词</span>
            <strong className="stat-value">{mastery.unseen}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">已练过</span>
            <strong className="stat-value">{mastery.practiced}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">已标记掌握</span>
            <strong className="stat-value">{mastery.markedMastered}</strong>
          </div>
        </div>
      </Card>

      <Card className="card-tone-neutral" title="学习时长与频次">
        <p>已记录训练用时：{statistics.totalMinutes} 分钟</p>
        <p>学习天数：{statistics.learningDays}</p>
        {dayFrequency
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
