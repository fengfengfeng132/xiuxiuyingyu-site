import { useState } from 'react';
import { isSubmitEnter } from '../lib/answerReview';
import { buildSpellingFeedback } from '../lib/spellingFeedback';

interface SpellingReviewProps {
  /** What the child typed; empty when the word was skipped or the input was not saved. */
  typed: string;
  answer: string;
  inputId: string;
  className?: string;
  nextLabel: string;
  /** Put the caret in the copy box right away (used when copying is the next thing to do). */
  focusOnMount?: boolean;
  /** Called when the correct word has been typed once. */
  onCopied: () => void;
  onNext: () => void;
}

// Shown after a wrong or skipped spelling: the aligned comparison, the correct word, and one copy-typing pass.
// Copying is practice only; the saved answer and score are never changed here.
export function SpellingReview({ typed, answer, inputId, className, nextLabel, focusOnMount = false, onCopied, onNext }: SpellingReviewProps) {
  const [copyInput, setCopyInput] = useState('');
  const typedLetters = typed.trim() ? buildSpellingFeedback(typed, answer).typedLetters : [];
  const copied = buildSpellingFeedback(copyInput, answer).isCorrect;

  return (
    <div className={['spelling-feedback-panel', className].filter(Boolean).join(' ')}>
      {typedLetters.length > 0 ? (
        <>
          <p className="spelling-feedback-label">你写的：</p>
          <div className="spelling-feedback-word" aria-label="你写的单词逐字对比">
            {typedLetters.map((letter, index) => (
              <span
                key={`typed-${index}-${letter.char}`}
                className={letter.isWrong ? 'spelling-feedback-letter spelling-feedback-letter-wrong' : 'spelling-feedback-letter'}
              >
                {letter.char}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <p className="spelling-feedback-label spelling-feedback-label-correct">正确单词：</p>
      <div className="spelling-feedback-word spelling-feedback-word-correct" aria-label="正确单词">
        {Array.from(answer).map((letter, index) => (
          <span key={`answer-${index}-${letter}`} className="spelling-feedback-letter spelling-feedback-letter-correct">
            {letter}
          </span>
        ))}
      </div>

      <label className={copied ? 'spelling-review-copy spelling-review-copy-done' : 'spelling-review-copy'} htmlFor={inputId}>
        <span>{copied ? '✓ 打对了，可以继续。' : '照着上面的正确单词，再打一遍：'}</span>
        <input
          id={inputId}
          value={copyInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCopyInput(nextValue);
            if (buildSpellingFeedback(nextValue, answer).isCorrect) onCopied();
          }}
          onKeyDown={(event) => {
            if (isSubmitEnter(event) && copied) onNext();
          }}
          autoFocus={focusOnMount}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {copied ? (
        <button className="btn btn-primary spelling-review-next" type="button" onClick={onNext}>
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}
