import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, startSession } from '../lib/storage';

function isDueTodayOrEarlier(dueAt: string): boolean {
  return new Date(dueAt).getTime() <= Date.now();
}

function getQuestionPrompt(questionId: number): string | null {
  const question = questionBank.find((item) => item.id === questionId);
  if (!question) return null;
  return question.prompt.replace(/^[\s"“”']+|[\s"“”'。.!?？]+$/g, '');
}

export function HomePage() {
  const navigate = useNavigate();
  const state = loadState();

  const pendingWrongCount = state.wrongBook.filter((x) => !x.mastered).length;
  const pendingReviewCount = state.reviewTasks.filter((x) => !x.completed).length;
  const dueReviewCount = state.reviewTasks.filter((x) => !x.completed && isDueTodayOrEarlier(x.dueAt)).length;

  const todayMission =
    dueReviewCount > 0 || pendingWrongCount > 0
      ? {
          query: 'mode=all&train=wrongFirst',
          title: '错题修复任务',
          desc: `优先练习错题和到期复习（当前到期：${dueReviewCount}）`,
        }
      : {
          query: 'mode=all&train=today10',
          title: '今日 10 分钟任务',
          desc: '10 个每日听写词，保持每天稳步学习。',
        };

  const beginLearning = (query: string) => {
    startSession();
    navigate(`/practice${query ? `?${query}` : ''}`);
  };

  const latest = state.sessions[0];
  const latestTotal = latest?.questionTotal ?? questionBank.length;
  const latestAccuracy = latest ? `${Math.round((latest.score / Math.max(latestTotal, 1)) * 100)}%` : '98%';
  const streakDays = latest ? Math.max(state.sessions.length, 1) : 12;
  const masteredCount = latest ? latest.score + Math.max(0, state.sessions.length - 1) * 10 : 156;
  const weakWordFallback = ['hot', 'finish', 'plant', 'clean', 'cold'];
  const weakWords = state.wrongBook
    .filter((item) => !item.mastered)
    .map((item) => getQuestionPrompt(item.questionId))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
  const displayedWeakWords = weakWords.length > 0 ? weakWords : weakWordFallback;
  const stats = [
    { value: latestAccuracy, label: '正确率', icon: '/images/ui-ipad/stat-check-icon.png' },
    { value: `${streakDays}天`, label: '连续学习', icon: '/images/ui-ipad/stat-fire-icon.png' },
    { value: `${masteredCount}个`, label: '已掌握单词', icon: '/images/ui-ipad/stat-medal-icon.png' },
  ];

  return (
    <main className="reference-page reference-home-page">
      <header className="reference-logo" aria-label="WOE L2 英语练习">
        <span className="reference-logo-mark">WOE</span>
        <span>L2</span>
      </header>

      <section className="home-task-card" aria-labelledby="home-task-title">
        <div className="home-task-copy">
          <span className="home-section-kicker">今日任务</span>
          <h1 id="home-task-title">今日任务</h1>
          <p>每天 10 分钟，坚持就是进步!</p>
        </div>

        <div className="home-hero-scene" aria-hidden="true">
          <img className="home-hero-illustration" src="/images/ui-ipad/hero-child-rabbit.png" alt="" />
        </div>

        <div className="home-task-progress">
          <img className="home-progress-clock" src="/images/ui-ipad/clock.png" alt="" aria-hidden="true" />
          <div>
            <span>今日学习进度</span>
            <strong>6</strong>
          </div>
          <div className="home-task-progress-track">
            <span style={{ width: '60%' }} />
          </div>
        </div>

        <span className="task-sticker task-sticker-clock" aria-hidden="true" />
        <img className="task-gift-image" src="/images/ui-ipad/gift.png" alt="" aria-hidden="true" />
      </section>

      <section className="home-feature-grid" aria-label="主要学习入口">
        <Link className="home-feature-card home-feature-card-blue" to="/dictation">
          <img className="feature-image feature-image-headset" src="/images/ui-ipad/headset.png" alt="" aria-hidden="true" />
          <span>
            <strong>听写单词</strong>
            <em>今日 20 个单词</em>
          </span>
          <b>开始学习</b>
        </Link>

        <Link className="home-feature-card home-feature-card-green" to="/review">
          <img className="feature-image feature-image-book" src="/images/ui-ipad/review-book.png" alt="" aria-hidden="true" />
          <span>
            <strong>复习巩固</strong>
            <em>错词复习{pendingWrongCount > 0 ? pendingWrongCount : 12}个</em>
          </span>
          <b>开始复习</b>
          <img className="feature-star-image" src="/images/ui-ipad/star-sticker.png" alt="" aria-hidden="true" />
        </Link>
      </section>

      <section className="home-panel">
        <div className="home-panel-heading">
          <img className="home-panel-title-icon" src="/images/ui-ipad/stat-bars-color-icon.png" alt="" aria-hidden="true" />
          <h2>学习统计</h2>
          <Link to="/parent">查看全部 &gt;</Link>
        </div>
        <div className="home-stat-row">
          {stats.map((item) => (
            <div key={item.label}>
              <img className="home-stat-icon" src={item.icon} alt="" aria-hidden="true" />
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-panel home-weak-panel">
        <div className="home-panel-heading">
          <img className="home-panel-title-icon" src="/images/ui-ipad/heart-bubble.png" alt="" aria-hidden="true" />
          <h2>需要加强的单词</h2>
          <Link to="/wrong">查看全部 &gt;</Link>
        </div>
        <div className="weak-chip-row">
          {displayedWeakWords.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>
      </section>

      <details className="reference-more-modes">
        <summary>更多训练模式</summary>
        <div className="reference-mode-grid">
          <Button variant="secondary" onClick={() => beginLearning(todayMission.query)}>
            {todayMission.title}
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=all')}>
            完整练习
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=all&train=random')}>
            随机模式
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=vocab&train=zh2en')}>
            中译英切换
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=all&train=audio')}>
            听力选择
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=vocab&train=spelling')}>
            拼写选择
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=dialogue&train=dialogueFill')}>
            对话填空
          </Button>
          <Button variant="secondary" onClick={() => beginLearning('mode=all&train=wrongFirst')}>
            错题优先
          </Button>
        </div>
        <p>{todayMission.desc}</p>
        <p>待复习任务：{pendingReviewCount}</p>
      </details>
    </main>
  );
}
