import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpellingReview } from '../src/components/SpellingReview';
import { ANSWER_REVEAL_GUARD_MS, isRevealGuardActive, isSubmitEnter, revealAboveBottomNav } from '../src/lib/answerReview';

afterEach(() => vi.unstubAllGlobals());

const dictationPageSource = readFileSync(new URL('../src/pages/DictationPage.tsx', import.meta.url), 'utf8');
const practicePageSource = readFileSync(new URL('../src/pages/PracticePage.tsx', import.meta.url), 'utf8');
const noop = () => undefined;

describe('spelling review card', () => {
  it('shows the aligned comparison, the correct word and a copy box, but no way forward until it is copied', () => {
    const html = renderToStaticMarkup(
      <SpellingReview typed="lonly" answer="lonely" inputId="copy-box" nextLabel="下一题" onCopied={noop} onNext={noop} />,
    );
    expect(html).toContain('你写的：');
    expect(html.match(/spelling-feedback-letter-wrong/g)).toHaveLength(1);
    expect(html.match(/spelling-feedback-letter-correct/g)).toHaveLength(6);
    expect(html).toContain('再打一遍');
    expect(html).toContain('id="copy-box"');
    expect(html).not.toContain('下一题');
  });

  it('leaves out the comparison when the word was skipped and nothing was typed', () => {
    const html = renderToStaticMarkup(
      <SpellingReview typed="" answer="play" inputId="copy-box" nextLabel="下一题" onCopied={noop} onNext={noop} />,
    );
    expect(html).not.toContain('你写的：');
    expect(html).toContain('正确单词：');
    expect(html.match(/spelling-feedback-letter-correct/g)).toHaveLength(4);
  });
});

describe('answer reveal guard', () => {
  it('ignores a second tap right after the answer appears and accepts a later one', () => {
    expect(isRevealGuardActive(10_000, 10_000)).toBe(true);
    expect(isRevealGuardActive(10_000, 10_000 + ANSWER_REVEAL_GUARD_MS - 1)).toBe(true);
    expect(isRevealGuardActive(10_000, 10_000 + ANSWER_REVEAL_GUARD_MS)).toBe(false);
    expect(isRevealGuardActive(0, 10_000)).toBe(false);
  });
});

describe('action row and the floating bottom navigation', () => {
  function stubPage(navTop: number | null) {
    const scrollBy = vi.fn();
    vi.stubGlobal('window', { innerHeight: 1366, scrollBy });
    vi.stubGlobal('document', { querySelector: () => (navTop === null ? null : { getBoundingClientRect: () => ({ top: navTop }) }) });
    return scrollBy;
  }
  const rowEndingAt = (bottom: number) => ({ getBoundingClientRect: () => ({ bottom }) }) as unknown as Element;
  const answerStartingAt = (top: number) => ({ getBoundingClientRect: () => ({ top }) }) as unknown as Element;

  it('moves the page just far enough to clear the navigation', () => {
    const scrollBy = stubPage(1170);
    revealAboveBottomNav(rowEndingAt(1256));
    expect(scrollBy).toHaveBeenCalledWith({ top: 98, behavior: 'smooth' });
  });

  it('leaves the page alone when the row is already reachable or missing', () => {
    const scrollBy = stubPage(1170);
    revealAboveBottomNav(rowEndingAt(1158));
    revealAboveBottomNav(null);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('falls back to the viewport edge on pages without the navigation', () => {
    const scrollBy = stubPage(null);
    revealAboveBottomNav(rowEndingAt(1400));
    expect(scrollBy).toHaveBeenCalledWith({ top: 46, behavior: 'smooth' });
  });

  it('scrolls the full distance while the revealed answer stays on screen', () => {
    const scrollBy = stubPage(1170);
    revealAboveBottomNav(rowEndingAt(1256), answerStartingAt(400));
    expect(scrollBy).toHaveBeenCalledWith({ top: 98, behavior: 'smooth' });
  });

  it('stops before the revealed answer would leave the top of the screen', () => {
    const scrollBy = stubPage(626);
    revealAboveBottomNav(rowEndingAt(900), answerStartingAt(72));
    expect(scrollBy).toHaveBeenCalledWith({ top: 60, behavior: 'smooth' });
  });

  it('does not move at all when the answer already sits at the top edge', () => {
    const scrollBy = stubPage(626);
    revealAboveBottomNav(rowEndingAt(900), answerStartingAt(8));
    revealAboveBottomNav(rowEndingAt(900), answerStartingAt(-40));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe('return key in spelling boxes', () => {
  it('submits on a plain Enter only', () => {
    expect(isSubmitEnter({ key: 'Enter', keyCode: 13, nativeEvent: { isComposing: false } })).toBe(true);
    expect(isSubmitEnter({ key: 'Enter' })).toBe(true);
    expect(isSubmitEnter({ key: 'a', keyCode: 65, nativeEvent: { isComposing: false } })).toBe(false);
  });

  it('ignores the Enter that only confirms an input-method composition', () => {
    expect(isSubmitEnter({ key: 'Enter', keyCode: 13, nativeEvent: { isComposing: true } })).toBe(false);
    expect(isSubmitEnter({ key: 'Enter', keyCode: 229, nativeEvent: { isComposing: false } })).toBe(false);
  });
});

describe('answer review flow', () => {
  it('never locks the dictation spelling box because of an audio message', () => {
    expect(dictationPageSource).not.toContain('disabled={Boolean(feedback)}');
    expect(dictationPageSource).toContain('disabled={hasSubmittedCurrentStep}');
    expect(dictationPageSource).not.toMatch(/setFeedback\(\s*getLocal(Slow)?WordAudioFeedback/);
    expect(practicePageSource).not.toMatch(/setFeedback\(\s*getLocal(Slow)?WordAudioFeedback/);
  });

  it('keeps the child on a skipped dictation question so the answer can be seen', () => {
    const skipBranch = dictationPageSource.slice(
      dictationPageSource.indexOf("userAnswer: '不会'"),
      dictationPageSource.indexOf('if (isCompleted) {'),
    );
    expect(skipBranch).toContain('setRevealedBySkip(true)');
    expect(skipBranch).not.toContain('moveNext()');
  });

  it('locks and reviews every answered practice question, whatever the mode', () => {
    expect(practicePageSource).toContain('getSavedExampleReview(question, existed, true)');
    expect(practicePageSource).toContain('getSavedExampleReview(question, savedAnswer, true)');
    expect(practicePageSource).not.toContain('已为你切换到相似题继续练习');
    expect(practicePageSource).toContain('getOptionRevealState(idx, selected, question.answerIndex, hasSubmittedExampleQuestion)');
  });

  it('submits a spelling with the return key in both spelling boxes', () => {
    expect(practicePageSource).toContain('if (isSubmitEnter(event)) submit();');
    expect(dictationPageSource).toContain('if (isSubmitEnter(event)) submitStep();');
  });

  it('records a round as soon as its last open question is answered', () => {
    const submitTail = practicePageSource.slice(practicePageSource.indexOf('session.questionIds = [...nextFlow];'));
    expect(submitTail.indexOf('isPracticeRoundFullyAnswered(nextFlow, session)')).toBeGreaterThan(-1);
    expect(submitTail.indexOf('finishRound(state, session, true)')).toBeLessThan(submitTail.indexOf('advanceAfterAnswer(nextFlow)'));
    expect(practicePageSource).toContain('saveState(finishRound(state, session, false));');
  });

  it('gives the spelling review a key of its own next to the example sentences', () => {
    // Two siblings with the same key made React duplicate the review card and drop what the child had typed.
    expect(dictationPageSource.match(/key=\{currentStep\.id\}/g)).toHaveLength(1);
    expect(dictationPageSource).toContain('key={`spelling-review-${currentStep.id}`}');
    expect(practicePageSource).toContain('key={`spelling-review-${question.id}`}');
  });

  it('hides the phonetic in listening practice and builds dialogue options without randomness', () => {
    expect(practicePageSource).toContain('canShowPracticePhonetic(train, hasSubmittedExampleQuestion)');
    expect(practicePageSource).toContain('buildDialogueFillQuestion(q, dialoguePool)');
    expect(practicePageSource).not.toContain('extractDialogueKeyword');
  });
});
