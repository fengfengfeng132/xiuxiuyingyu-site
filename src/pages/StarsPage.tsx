import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { getStarCount } from '../lib/starRewards';
import { loadState } from '../lib/storage';

function getSourceLabel(sourceType: 'practice' | 'dictation'): string {
  return sourceType === 'dictation' ? '每日听写' : '练习模式';
}

export function StarsPage() {
  const state = loadState();
  const starRecords = state.starRecords;

  return (
    <main className="page stars-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">星星奖励</p>
        <h1>我的星星记录</h1>
        <p className="page-lead">每次满分完成一轮训练，就会自动增加 1 颗星。这里会记录是哪一次训练得到的。</p>
      </section>

      <Card className="card-tone-yellow" title="星星总数">
        <div className="stats-grid stats-grid-compact">
          <div className="stat-card stat-card-white star-total-card">
            <span className="stat-label">已获得</span>
            <strong className="stat-value">{getStarCount(state)} 颗</strong>
          </div>
        </div>
      </Card>

      {starRecords.length === 0 ? (
        <Card className="card-tone-mint" title="还没有星星">
          <p>下一次满分完成训练，就能在这里看到第一颗星。</p>
          <Link className="link-reset" to="/">
            <Button fullWidth>去学习中心</Button>
          </Link>
        </Card>
      ) : (
        <Card className="card-tone-blue" title="获得记录">
          <div className="star-record-list">
            {starRecords.map((record) => (
              <article className="star-record-item" key={record.id}>
                <span className="star-record-icon" aria-hidden="true">
                  ★
                </span>
                <div>
                  <strong>{record.title}</strong>
                  <p>
                    {getSourceLabel(record.sourceType)} · 满分 {record.score}/{record.total}
                  </p>
                  <time dateTime={record.earnedAt}>{new Date(record.earnedAt).toLocaleString()}</time>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
