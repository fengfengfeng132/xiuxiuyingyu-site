const imageCache = new Map<string, string | null>();

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const wordEmojiMap: Record<string, string> = {
  keyboard: '⌨️',
  guitar: '🎸',
  trumpet: '🎺',
  drum: '🥁',
  xylophone: '🎼',
  recorder: '🪈',
  violin: '🎻',
  piano: '🎹',
  throw: '🥎',
  catch: '🤲',
  hit: '👊',
  kick: '🦵',
  clean: '🧽',
  wash: '🧼',
  draw: '✏️',
  paint: '🎨',
  climb: '🧗',
  slide: '🛝',
  skip: '🤸',
  hop: '🦘',
  bed: '🛏️',
  bath: '🛁',
  box: '📦',
  bus: '🚌',
  cloth: '👕',
  fox: '🦊',
  hen: '🐔',
  pig: '🐷',
  ox: '🐂',
  hat: '🧢',
  leg: '🦵',
  home: '🏠',
  hot: '🔥',
  wet: '💧',
  thin: '📏',
  thick: '📚',
  rug: '🧶',
  mug: '☕',
  math: '➕',
  pin: '📌',
  wig: '👩',
  bud: '🌱',
  lug: '🧳',
  net: '🥅',
  nut: '🥜',
  moth: '🦋',
  path: '🛣️',
  set: '🧩',
  sit: '🪑',
  this: '👉',
  that: '👈',
  them: '👥',
  an: '🔤',
  of: '🔗',
  bess: '👧',
  meg: '👧',
};

function pickEmoji(word: string, hint = ''): string {
  const key = normalizeWord(word);
  if (wordEmojiMap[key]) return wordEmojiMap[key];

  const source = `${key} ${hint.toLowerCase()}`;
  if (source.includes('music') || source.includes('乐')) return '🎵';
  if (source.includes('animal') || source.includes('动物')) return '🐾';
  if (source.includes('verb') || source.includes('动作')) return '🏃';
  if (source.includes('color') || source.includes('颜色')) return '🎨';
  if (source.includes('food') || source.includes('食')) return '🍎';
  if (source.includes('body') || source.includes('身体')) return '🧍';
  return '📘';
}

function buildSvgDataUrl(word: string, emoji: string): string {
  const safeWord = escapeXml(word);
  const safeEmoji = escapeXml(emoji);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f5f8ff"/>
      <stop offset="100%" stop-color="#eefaf3"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="640" height="360" rx="24" fill="url(#bg)"/>
  <rect x="26" y="22" width="588" height="316" rx="20" fill="#ffffff" stroke="#d7e2ff" stroke-width="3"/>
  <text x="320" y="175" text-anchor="middle" font-size="116">${safeEmoji}</text>
  <text x="320" y="275" text-anchor="middle" font-size="46" font-family="Arial, sans-serif" font-weight="700" fill="#254b91">${safeWord}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function fetchWordImage(word: string, hint?: string): Promise<string | null> {
  const key = normalizeWord(word);
  if (!key) return null;

  if (imageCache.has(key)) {
    return imageCache.get(key) ?? null;
  }

  const emoji = pickEmoji(key, hint);
  const image = buildSvgDataUrl(key, emoji);
  imageCache.set(key, image);
  return image;
}
