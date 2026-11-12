// After an answer is revealed, the button under the child's finger turns into "下一题" or "跳过".
// A quick second tap must not skip the answer that has just appeared.
export const ANSWER_REVEAL_GUARD_MS = 600;

export function isRevealGuardActive(revealedAt: number, now: number = Date.now()): boolean {
  return now - revealedAt < ANSWER_REVEAL_GUARD_MS;
}

const BOTTOM_NAV_GAP_PX = 12;

// The bottom navigation floats over the page. Once an answer is revealed, the row with "下一题" must not stay
// hidden under it, so the page moves down just far enough. Nothing happens when the row is already reachable.
export function revealAboveBottomNav(element: Element | null): void {
  if (!element || typeof window === 'undefined' || typeof document === 'undefined') return;
  const nav = document.querySelector('.bottom-nav');
  const limit = (nav ? nav.getBoundingClientRect().top : window.innerHeight) - BOTTOM_NAV_GAP_PX;
  const overflow = element.getBoundingClientRect().bottom - limit;
  if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'smooth' });
}
