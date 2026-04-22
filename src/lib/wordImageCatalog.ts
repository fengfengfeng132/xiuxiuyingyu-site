const projectWordImages: Record<string, string> = {
  hot: '/images/dictation-words/hot.webp',
  cold: '/images/dictation-words/cold.webp',
  fast: '/images/dictation-words/fast.webp',
  slow: '/images/dictation-words/slow.webp',
  hard: '/images/dictation-words/hard.webp',
  soft: '/images/dictation-words/soft.webp',
  too: '/images/dictation-words/too.webp',
  put: '/images/dictation-words/put.webp',
  but: '/images/dictation-words/but.webp',
  mad: '/images/dictation-words/mad.webp',
  cake: '/images/dictation-words/cake.webp',
  same: '/images/dictation-words/same.webp',
};

function normalizeHint(input?: string): string {
  return (input ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function normalizeWordImageKey(input: string): string {
  return input.trim().toLowerCase();
}

export function createWordImageCacheKey(word: string, hint?: string): string {
  const normalizedWord = normalizeWordImageKey(word);
  const normalizedHint = normalizeHint(hint);
  return normalizedHint ? `${normalizedWord}::${normalizedHint}` : normalizedWord;
}

export function getProjectWordImage(word: string): string | null {
  const normalizedWord = normalizeWordImageKey(word);
  return projectWordImages[normalizedWord] ?? null;
}
