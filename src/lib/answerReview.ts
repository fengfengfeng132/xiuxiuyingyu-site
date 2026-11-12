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

const BOTTOM_NAV_GAP_PX = 12;
const TOP_GAP_PX = 12;

// The bottom navigation floats over the page. Once an answer is revealed, the row with "下一题" must not stay
// hidden under it, so the page moves down just far enough. It never moves so far that the revealed answer
// (keepVisible) leaves the top of the screen: when both do not fit, the answer wins and the row is reached by scrolling.
export function revealAboveBottomNav(actionRow: Element | null, keepVisible: Element | null = null): void {
  if (!actionRow || typeof window === 'undefined' || typeof document === 'undefined') return;
  const nav = document.querySelector('.bottom-nav');
  const limit = (nav ? nav.getBoundingClientRect().top : window.innerHeight) - BOTTOM_NAV_GAP_PX;
  const overflow = actionRow.getBoundingClientRect().bottom - limit;
  const room = keepVisible ? keepVisible.getBoundingClientRect().top - TOP_GAP_PX : overflow;
  const distance = Math.min(overflow, room);
  if (distance > 0) window.scrollBy({ top: distance, behavior: 'smooth' });
}
