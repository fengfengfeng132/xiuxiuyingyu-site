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
      <h1>结果</h1>
      <Card title="本轮总结">
        <p>作答：{answered} / {targetCount}</p>
        <p>答对：{latest.score}</p>
        <p>答错：{wrongCount}</p>
        <p>正确率：{percent}%（答对/{targetCount}）</p>
      </Card>

      {wrongReviewWords.length > 0 ? (
        <Card title="着重复习这些单词" subtitle="这些词已经自动加入错题本，下一轮优先回看。">
          {wrongReviewWords.map((item, index) => (
            <p key={item.questionId}>
              {index + 1}. {item.prompt} · {item.meaning}（本轮错了 {item.wrongCount} 次）
            </p>
          ))}
        </Card>
      ) : null}

      {wrongDetails.length > 0 ? (
        <Card title="本轮错误详情与正确答案">
          {wrongDetails.map((item, index) => (
            <p key={item.id}>
              {index + 1}. {item.prompt} {'→'} {item.correctLabel}. {item.correctOption}
            </p>
          ))}
        </Card>
      ) : null}

      <Card title="下一步">
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
