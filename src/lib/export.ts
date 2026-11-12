import { questionBank } from '../data/loadQuestionBank';
import { loadState } from './storage';
import { getLearningStatistics, getTrainingAccuracy } from './learningStats';

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

export function exportStateAsJson() {
  const state = loadState();
  const filename = `woe_l2_records_${nowStamp()}.json`;
  downloadTextFile(JSON.stringify(state, null, 2), filename, 'application/json;charset=utf-8');
}

export function exportSessionsAsCsv() {
  const state = loadState();
  const header = ['session_id', 'started_at', 'finished_at', 'mode', 'train', 'score', 'accuracy_percent', 'answered_count', 'target_count', 'source', 'title'];
  const rows = getLearningStatistics(state, questionBank).rounds.map((round) => {
    const accuracyPercent = getTrainingAccuracy(round);
    return [
      round.id,
      round.startedAt ?? '',
      round.finishedAt,
      round.mode ?? '',
      round.train ?? '',
      round.correctCount ?? '',
      accuracyPercent ?? '',
      round.answeredCount,
      round.questionTotal ?? '',
      round.source,
      round.title,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const filename = `woe_l2_sessions_${nowStamp()}.csv`;
  downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
}
