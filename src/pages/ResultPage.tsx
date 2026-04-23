import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, startSession } from '../lib/storage';
import { collectWrongWordReviewItems } from '../lib/studyFeedback';

function getTargetCount(score: number, answered: number, storedTotal?: number): number {
  if (typeof storedTotal === 'number' && storedTotal > 0) {
    return Math.max(storedTotal, score, 1);
  }
  return Math.max(answered, score, 1);
}

export function ResultPage() {
  const latest = loadState().sessions[0];

  if (!latest) {
    return (
      <main className="page">
        <p>还没有学习结果，先完成一轮练习吧。</p>
        <Link className="link-reset" to="/practice">
          <Button>去练习</Button>
        </Link>
      </main>
    );
  }

  const answered = latest.answers.length;
  const targetCount = getTargetCount(latest.score, answered, latest.questionTotal);
  const wrongCount = Math.max(targetCount - latest.score, 0);
  const percent = Math.round((latest.score / targetCount) * 100);
  const isSpellingRound = latest.train === 'spelling';
  const wrongReviewWords = collectWrongWordReviewItems(latest.answers, questionBank);

  const wrongDetails = latest.answers
    .filter((answer) => !answer.isCorrect)
    .map((answer) => {
      const question = questionBank.find((item) => item.id === answer.questionId);
      if (!question) return null;

      const correctOption = isSpellingRound
        ? question.prompt
        : question.options[question.answerIndex] ?? '（缺少正确答案）';

      return {
        id: question.id,
        prompt: question.prompt,
        correctLabel: isSpellingRound ? '拼写' : String.fromCharCode(65 + question.answerIndex),
        correctOption,
      };
    })
    .filter(Boolean) as Array<{
    id: number;
    prompt: string;
    correctLabel: string;
    correctOption: string;
  }>;

  return (
    <main className="page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">结果页</p>
        <h1>本轮学习总结</h1>
        <p className="page-lead">先看这轮做得怎么样，再决定是回错题、继续做题，还是直接回首页。</p>
      </section>

      <Card className="card-tone-blue" title="本轮总结">
        <div className="stats-grid stats-grid-compact">
          <div className="stat-card stat-card-white">
            <span className="stat-label">作答</span>
            <strong className="stat-value">
              {answered} / {targetCount}
            </strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">答对</span>
            <strong className="stat-value">{latest.score}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">答错</span>
            <strong className="stat-value">{wrongCount}</strong>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label">正确率</span>
            <strong className="stat-value">{percent}%</strong>
          </div>
        </div>
      </Card>

      {wrongReviewWords.length > 0 ? (
        <Card className="card-tone-coral" title="着重复习这些单词" subtitle="这些词已经自动加入错题本，下一轮优先回看。">
          {wrongReviewWords.map((item, index) => (
            <p key={item.questionId}>
              {index + 1}. {item.prompt} · {item.meaning}（本轮错了 {item.wrongCount} 次）
            </p>
          ))}
        </Card>
      ) : null}

      {wrongDetails.length > 0 ? (
        <Card className="card-tone-neutral" title="本轮错误详情与正确答案">
          {wrongDetails.map((item, index) => (
            <p key={item.id}>
              {index + 1}. {item.prompt} {'→'} {item.correctLabel}. {item.correctOption}
            </p>
          ))}
        </Card>
      ) : null}

      <Card className="card-tone-yellow" title="下一步">
        <div style={{ display: 'grid', gap: 10 }}>
          <Link className="link-reset" to="/wrong">
            <Button variant="secondary" fullWidth>
              打开错题本
            </Button>
          </Link>
          <Link className="link-reset" to="/practice" onClick={() => startSession()}>
            <Button fullWidth>再来一轮</Button>
          </Link>
          <Link className="link-reset" to="/">
            <Button variant="ghost" fullWidth>
              返回首页
            </Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
