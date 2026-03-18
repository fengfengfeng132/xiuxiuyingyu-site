interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.max(0, Math.round((current / safeTotal) * 100)));

  return (
    <div className="progress-wrap" aria-label="学习进度">
      <div className="progress-meta">
        <span>进度</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
