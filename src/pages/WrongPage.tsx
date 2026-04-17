import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { questionBank } from '../data/loadQuestionBank';
import { loadState, saveState } from '../lib/storage';

function extractMeaning(explanation?: string): string {
  if (!explanation) return '暂无释义';
  const parts = explanation.trim().split(/\s+/);
  return parts.length >= 2 ? parts.slice(1).join(' ') : explanation;
}

export function WrongPage() {
  const state = loadState();
  const wrongBook = state.wrongBook;

  const markMastered = (questionId: number) => {
    const next = loadState();
    next.wrongBook = next.wrongBook.map((item) =>
      item.questionId === questionId ? { ...item, mastered: true } : item,
    );
    saveState(next);
    window.location.reload();
  };

  return (
    <main className="page">
      <h1>错题本</h1>
      <Card title="本地错题记录">
        <p>当前错题数：{wrongBook.length}</p>
        <p>未掌握：{wrongBook.filter((x) => !x.mastered).length}</p>
      </Card>

      {wrongBook.length === 0 ? (
        <Card title="太棒了！">
          <p>暂时没有错题，继续保持。</p>
        </Card>
      ) : (
        wrongBook
          .slice()
          .sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt))
          .map((item) => {
            const q = questionBank.find((x) => x.id === item.questionId);
            return (
              <Card key={item.questionId} title={q?.prompt ?? `题目 #${item.questionId}`} subtitle={q?.stem}>
                <p>重点词义：{extractMeaning(q?.explanation)}</p>
                <p>错误次数：{item.wrongCount}</p>
                <p>状态：{item.mastered ? '已掌握' : '待复习'}</p>
                <p>最近错题时间：{new Date(item.lastWrongAt).toLocaleString()}</p>
                {!item.mastered ? (
                  <Button variant="secondary" fullWidth onClick={() => markMastered(item.questionId)}>
                    标记为已掌握
                  </Button>
                ) : null}
              </Card>
            );
          })
      )}
    </main>
  );
}
