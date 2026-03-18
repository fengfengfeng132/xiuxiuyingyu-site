import { QUESTION_TOTAL } from '../data/loadQuestionBank';
import { loadState } from './storage';

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getSessionTotal(scoreCount: number, answeredCount: number): number {
  const fallback = answeredCount > 0 ? answeredCount : QUESTION_TOTAL;
  return Math.max(scoreCount, fallback, 1);
}

export function exportStateAsJson() {
  const state = loadState();
  const filename = `woe_l2_records_${nowStamp()}.json`;
  downloadTextFile(JSON.stringify(state, null, 2), filename, 'application/json;charset=utf-8');
}

export function exportSessionsAsCsv() {
  const state = loadState();
  const header = ['session_id', 'started_at', 'finished_at', 'mode', 'train', 'score', 'accuracy_percent', 'answered_count', 'target_count'];
  const rows = state.sessions.map((s) => {
    const targetCount = typeof s.questionTotal === 'number' ? s.questionTotal : getSessionTotal(s.score, s.answers.length);
    const accuracyPercent = Math.round((s.score / Math.max(targetCount, 1)) * 100);
    return [
      s.id,
      s.startedAt,
      s.finishedAt ?? '',
      s.mode ?? '',
      s.train ?? '',
      String(s.score),
      String(accuracyPercent),
      String(s.answers.length),
      String(targetCount),
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const filename = `woe_l2_sessions_${nowStamp()}.csv`;
  downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
}
