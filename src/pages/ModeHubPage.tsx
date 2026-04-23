import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { getStarCount } from '../lib/starRewards';
import { loadState, startSession } from '../lib/storage';

interface ModeCard {
  title: string;
  desc: string;
  action: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'coral' | 'yellow';
  icon: string;
  query?: string;
  to?: string;
}

const routeSteps = [
  {
    title: '今日 10 分钟',
    desc: '坚持学习',
    meta: '6/10 分钟',
    icon: '/images/ui-ipad/clock.png',
    query: 'mode=all&train=today10',
  },
  {
    title: '每日 20 题',
    desc: '巩固提升',
    meta: '8/20 题',
    icon: '/images/ui-ipad/review-book.png',
    query: 'mode=all&train=daily20',
  },
  {
    title: '等级闯关',
    desc: '挑战进阶',
    meta: 'Lv.2 进行中',
    icon: '/images/ui-ipad/stat-medal-icon.png',
    query: 'mode=all&train=level10',
  },
];

const modeCards: ModeCard[] = [
  {
    title: '听写单词',
    desc: '今日 20 词',
    action: '开始学习',
    tone: 'blue',
    icon: '/images/ui-ipad/headset.png',
    to: '/dictation',
  },
  {
    title: '听力选择',
    desc: '每日 20 题',
    action: '开始练习',
    tone: 'orange',
    icon: '/images/ui-ipad/slow-turtle-icon.png',
    query: 'mode=all&train=audio',
  },
  {
    title: '拼写练习',
    desc: '拼写能力',
    action: '开始练习',
    tone: 'green',
    icon: '/images/ui-ipad/nav-book-icon.png',
    query: 'mode=vocab&train=spelling',
  },
  {
    title: '中译英',
    desc: '今日 20 题',
    action: '开始练习',
    tone: 'purple',
    icon: '/images/ui-ipad/pencil-icon.png',
    query: 'mode=vocab&train=zh2en',
  },
  {
    title: '对话填空',
    desc: '每日 15 题',
    action: '开始练习',
    tone: 'blue',
    icon: '/images/ui-ipad/heart-bubble.png',
    query: 'mode=dialogue&train=dialogueFill',
  },
  {
    title: '错题优先',
    desc: '先补错题',
    action: '开始练习',
    tone: 'coral',
    icon: '/images/ui-ipad/stat-fire-icon.png',
    query: 'mode=all&train=wrongFirst',
  },
  {
    title: '间隔复习',
    desc: '科学复习',
    action: '开始复习',
    tone: 'green',
    icon: '/images/ui-ipad/stat-check-icon.png',
    query: 'mode=all&train=spaced',
  },
  {
    title: '收藏单词',
    desc: '我的收藏',
    action: '查看收藏',
    tone: 'yellow',
    icon: '/images/ui-ipad/star-sticker.png',
    query: 'mode=all&train=random',
  },
];

export function ModeHubPage() {
  const navigate = useNavigate();
  const state = loadState();
  const pendingWrongCount = state.wrongBook.filter((item) => !item.mastered).length;
  const starCount = getStarCount(state);

  const beginLearning = (query: string) => {
    startSession();
    navigate(`/practice?${query}`);
  };

  const openCard = (card: ModeCard) => {
    if (card.to) {
      navigate(card.to);
      return;
    }

    if (card.query) beginLearning(card.query);
  };

  return (
    <main className="reference-page mode-hub-page">
      <header className="mode-hub-topbar">
        <div className="reference-logo" aria-label="WOE L2 英语练习">
          <span className="reference-logo-mark">WOE</span>
          <span>L2</span>
        </div>
        <Link className="lesson-star-badge" to="/stars" aria-label={`学习星星 ${starCount} 个，查看获得记录`}>
          {starCount}
        </Link>
      </header>

      <section className="mode-hub-hero">
        <div>
          <h1>学习中心</h1>
          <p>每天进步一点点，英语更出色!</p>
        </div>
        <img src="/images/ui-ipad/hero-child-rabbit.png" alt="" aria-hidden="true" />
      </section>

      <section className="mode-route-panel">
        <h2>今日学习路线</h2>
        <div className="mode-route-grid">
          {routeSteps.map((step, index) => (
            <button key={step.title} type="button" onClick={() => beginLearning(step.query)}>
              <span className="mode-step-number">{index + 1}</span>
              <img src={step.icon} alt="" aria-hidden="true" />
              <strong>{step.title}</strong>
              <em>{step.desc}</em>
              <b>{step.meta}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="mode-card-panel">
        <div className="home-panel-heading">
          <h2>学习模式</h2>
          <span>错题待修复 {pendingWrongCount} 个</span>
        </div>
        <div className="mode-card-grid">
          {modeCards.map((card) => (
            <article key={card.title} className={`mode-card mode-card-${card.tone}`}>
              <img src={card.icon} alt="" aria-hidden="true" />
              <div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
              <Button onClick={() => openCard(card)}>{card.action}</Button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
