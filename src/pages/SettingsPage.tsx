import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { exportSessionsAsCsv, exportStateAsJson } from '../lib/export';
import { resetState } from '../lib/storage';

export function SettingsPage() {
  const navigate = useNavigate();

  const clearAll = () => {
    const ok = window.confirm('确认清空所有本地学习记录吗？此操作无法撤销。');
    if (!ok) return;
    resetState();
    navigate('/');
  };

  return (
    <main className="page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">设置</p>
        <h1>导出、查看和清理</h1>
        <p className="page-lead">把当前规则、数据导出和数据管理集中放到一起，减少来回找入口的负担。</p>
      </section>

      <Card className="card-tone-neutral" title="当前规则">
        <ul className="detail-bullets">
          <li>每日推荐：10 分钟任务</li>
          <li>正确率公式：答对数 / 本轮题目数</li>
          <li>录音：本地占位（后续可接入 MediaRecorder）</li>
          <li>目标域名：xiuxiuyingyu.pages.dev</li>
        </ul>
      </Card>

      <Card className="card-tone-blue" title="导出数据">
        <div className="actions-stack">
          <Button variant="secondary" fullWidth onClick={exportSessionsAsCsv}>
            导出 CSV
          </Button>
          <Button variant="secondary" fullWidth onClick={exportStateAsJson}>
            导出 JSON
          </Button>
        </div>
      </Card>

      <Card className="card-tone-coral" title="数据管理">
        <Button variant="secondary" fullWidth onClick={clearAll}>
          清空本地记录
        </Button>
      </Card>
    </main>
  );
}
