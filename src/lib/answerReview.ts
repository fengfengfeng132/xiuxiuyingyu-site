// After an answer is revealed, the button under the child's finger turns into "下一题" or "跳过".
// A quick second tap must not skip the answer that has just appeared.
export const ANSWER_REVEAL_GUARD_MS = 600;

export function isRevealGuardActive(revealedAt: number, now: number = Date.now()): boolean {
  return now - revealedAt < ANSWER_REVEAL_GUARD_MS;
}

// The return key submits a spelling. An Enter that only confirms an input-method composition (Pinyin keyboard)
// must not: Safari reports that key press with keyCode 229 while isComposing is already false.
export function isSubmitEnter(event: { key: string; keyCode?: number; nativeEvent?: { isComposing?: boolean } }): boolean {
  return event.key === 'Enter' && event.keyCode !== 229 && !event.nativeEvent?.isComposing;
}

const VIEWPORT_GAP_PX = 12;

// Keep the answer visible when the action and the answer cannot both fit above the keyboard or screen edge.
export function revealAnswerActions(actionRow: Element | null, keepVisible: Element | null = null): void {
  if (!actionRow || typeof window === 'undefined') return;
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const overflow = actionRow.getBoundingClientRect().bottom - (bottom - VIEWPORT_GAP_PX);
  const room = keepVisible ? keepVisible.getBoundingClientRect().top - (top + VIEWPORT_GAP_PX) : overflow;
  const distance = Math.min(overflow, room);
  if (distance > 0) window.scrollBy({ top: distance, behavior: 'smooth' });
}
