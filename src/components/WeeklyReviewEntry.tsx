import type { AppState, Question } from '../types/schema';
import { selectReviewQuestions } from '../lib/reviewSelection';
import { Button } from './Button';
import { Card } from './Card';

interface WeeklyReviewEntryProps {
  bank: Question[];
  state: AppState;
  onStart: () => void;
  compact?: boolean;
}

export function WeeklyReviewEntry({ bank, state, onStart, compact = false }: WeeklyReviewEntryProps) {
  const vocabularyBank = bank.filter((question) => question.tags.includes('vocab-qa') || question.tags.includes('vocab'));
  const plan = selectReviewQuestions(vocabularyBank, state, { kind: 'weekly' });
  const wrongIds = new Set(state.wrongBook.filter((item) => !item.mastered && item.wrongCount > 0).map((item) => item.questionId));
  const plannedWrongCount = plan.filter((question) => wrongIds.has(question.id)).length;
  const planText = plannedWrongCount > 0
    ? `本次计划 ${plan.length} 个词，其中 ${plannedWrongCount} 个错词优先复习。`
    : plan.length > 0 ? `本次计划 ${plan.length} 个旧词，穿插复习，记得更牢。` : '目前没有可复习的词。';
  const compactPlanText = plannedWrongCount > 0
    ? `计划 ${plan.length} 词 · 错词 ${plannedWrongCount} 个`
    : plan.length > 0 ? `旧词巩固 · ${plan.length} 词` : '暂无可复习单词';

  if (compact) {
    return (
      <article className="mode-card mode-card-green mode-card-weekly">
        <img src="/images/ui-ipad/review-book.png" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <div>
          <h3>一周再背</h3>
          <p>{compactPlanText}</p>
        </div>
        <Button onClick={onStart} disabled={plan.length === 0}>开始复习</Button>
      </article>
    );
  }

  return (
    <Card className="card-tone-mint weekly-review-entry" title="一周再背 · 错词优先">
      <p className="weekly-review-plan">{planText}</p>
      <p>每轮最多 10 个词。错词够多时，约 7 个会选错词；反复出错和到期还没复习的词优先，其余旧词穿插巩固。</p>
      <Button fullWidth onClick={onStart} disabled={plan.length === 0}>开始一周复习</Button>
    </Card>
  );
}
