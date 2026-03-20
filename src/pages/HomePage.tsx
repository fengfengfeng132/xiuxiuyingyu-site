import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, startSession } from '../lib/storage';

function isDueTodayOrEarlier(dueAt: string): boolean {
  return new Date(dueAt).getTime() <= Date.now();
}

export function HomePage() {
  const navigate = useNavigate();
  const state = loadState();

  const vocabCount = questionBank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab')).length;
  const dialogueCount = questionBank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('dialogue')).length;

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
          desc: '10 道混合题，保持每天稳步学习。',
        };

  const beginLearning = (query: string) => {
    startSession();
    navigate(`/practice${query ? `?${query}` : ''}`);
  };

  const latest = state.sessions[0];
  const latestTotal = latest?.questionTotal ?? questionBank.length;

  return (
    <main className="page">
      <h1>WOE L2 英语练习</h1>
      <p className="muted">简洁界面 · 本地存储 · iPad 优先</p>

      <Card title={`推荐：${todayMission.title}`} subtitle={todayMission.desc}>
        <div className="actions-stack">
          <Button fullWidth onClick={() => beginLearning(todayMission.query)}>
            开始今日任务（约 10 分钟）
          </Button>
          <p className="muted">未掌握错题：{pendingWrongCount} · 待复习任务：{pendingReviewCount}</p>
        </div>
      </Card>

      <Card title="听写单词 · 先把这 10 个词练熟" subtitle="先认识词义，再听音辨义，最后听音拼写。">
        <div className="actions-stack">
          <Button fullWidth onClick={() => navigate('/dictation')}>
            开始听写单词学习
          </Button>
          <p className="muted">look · mop · sweep · cut · paint · with · that · baby · bath · thin</p>
        </div>
      </Card>

      <details className="more-modes">
        <summary>更多训练模式</summary>

        <Card title="核心记忆">
          <div className="actions-stack">
            <Button fullWidth onClick={() => beginLearning('mode=all')}>
              完整练习（英译中）
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=random')}>
              随机模式
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=vocab&train=zh2en')}>
              中译英切换
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=audio')}>
              听力选择
            </Button>
          </div>
        </Card>

        <Card title="识别强化">
          <div className="actions-stack">
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=vocab&train=spelling')}>
              拼写选择
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=vocab&train=initial')}>
              首字母提示
            </Button>
          </div>
        </Card>

        <Card title="对话与语法">
          <div className="actions-stack">
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=dialogue&train=dialogueFill')}>
              对话填空
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=dialogue&train=qaMatch')}>
              问答匹配
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=person')}>
              人称转换
            </Button>
          </div>
        </Card>

        <Card title="复习策略">
          <div className="actions-stack">
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=wrongFirst')}>
              错题优先
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=spaced')}>
              间隔复习（1/3/7/14 天）
            </Button>
          </div>
        </Card>

        <Card title="闯关激励">
          <div className="actions-stack">
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=level10')}>
              等级模式（10 题）
            </Button>
            <Button variant="secondary" fullWidth onClick={() => beginLearning('mode=all&train=daily20')}>
              每日挑战（20 题）
            </Button>
          </div>
        </Card>
      </details>

      <Card title="学习总览">
        <p>总题数：{questionBank.length}</p>
        <p>词汇题：{vocabCount}</p>
        <p>对话题：{dialogueCount}</p>
        <p>完成轮次：{state.sessions.length}</p>
        <p>错题总数：{state.wrongBook.length}</p>
        <p>待复习任务：{pendingReviewCount}</p>
        {latest ? <p>最近成绩：{latest.score} / {latestTotal}</p> : <p>最近成绩：暂无</p>}
      </Card>

      <nav className="grid-nav">
        <Link to="/dictation">听写</Link>
        <Link to="/result">结果</Link>
        <Link to="/wrong">错题本</Link>
        <Link to="/review">复习</Link>
        <Link to="/parent">家长看板</Link>
        <Link to="/settings">设置</Link>
      </nav>
    </main>
  );
}
