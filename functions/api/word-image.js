const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const LONG_CACHE = 'public, max-age=1209600, s-maxage=1209600';
const SHORT_CACHE = 'public, max-age=900, s-maxage=900';
const CACHE_VERSION = 'ai-v4-hint-seeded';

const wordEmojiMap = {
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

function normalizeWord(input) {
  return (input || '').trim().toLowerCase();
}

function sanitizeWord(input) {
  const word = normalizeWord(input);
  if (!word) return '';
  if (!/^[a-z]+(?:[-'][a-z]+)*$/.test(word)) return '';
  if (word.length > 40) return '';
  return word;
}

function sanitizeHint(input) {
  return (input || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pickEmoji(word, hint = '') {
  if (wordEmojiMap[word]) return wordEmojiMap[word];

  const source = `${word} ${hint.toLowerCase()}`;
  if (source.includes('music') || source.includes('乐')) return '🎵';
  if (source.includes('animal') || source.includes('动物')) return '🐾';
  if (source.includes('verb') || source.includes('动作')) return '🏃';
  if (source.includes('color') || source.includes('颜色')) return '🎨';
  if (source.includes('food') || source.includes('食')) return '🍎';
  if (source.includes('body') || source.includes('身体')) return '🧍';
  return '📘';
}

function buildFallbackSvg(word, hint) {
  const safeEmoji = escapeXml(pickEmoji(word, hint));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f5f8ff"/>
      <stop offset="100%" stop-color="#eefaf3"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="640" height="640" rx="28" fill="url(#bg)"/>
  <rect x="30" y="30" width="580" height="580" rx="24" fill="#ffffff" stroke="#d7e2ff" stroke-width="4"/>
  <circle cx="320" cy="300" r="138" fill="#e8f0ff" stroke="#bfd3ff" stroke-width="6"/>
  <text x="320" y="350" text-anchor="middle" font-size="170">${safeEmoji}</text>
</svg>`;
}

function fallbackResponse(word, hint, status = 200) {
  const svg = buildFallbackSvg(word, hint);
  return new Response(svg, {
    status,
    headers: {
      'content-type': 'image/svg+xml; charset=UTF-8',
      'cache-control': SHORT_CACHE,
      'x-word-image-source': 'fallback',
      'x-word-image-style': 'fallback-emoji-v3',
    },
  });
}

function buildPrompt(word, hint) {
  const hintText = hint ? `Use this exact visual meaning hint as the scene: ${hint}.` : '';
  return [
    `A realistic educational photo-style image for the English vocabulary word "${word}".`,
    hintText,
    'Use the most literal concrete scene for the meaning so a young child can understand it quickly.',
    'One clear subject only, centered composition, natural proportions, realistic textures, soft natural daylight,',
    'light plain background, high detail, child-safe, classroom flashcard style.',
    'No text, no letters, no logos, no watermark, not abstract, not cartoon, not anime.',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAiBinding(env) {
  return Boolean(env && env.AI && typeof env.AI.run === 'function');
}

function decodeBase64Image(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const word = sanitizeWord(url.searchParams.get('word'));
  const hint = sanitizeHint(url.searchParams.get('hint'));

  if (!word) {
    return new Response('Invalid word', { status: 400 });
  }

  const cacheUrl = new URL(url.origin);
  cacheUrl.pathname = '/api/word-image';
  cacheUrl.searchParams.set('word', word);
  if (hint) cacheUrl.searchParams.set('hint', hint);
  cacheUrl.searchParams.set('v', CACHE_VERSION);

  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasAiBinding(context.env)) {
    const fallback = fallbackResponse(word, hint);
    context.waitUntil(cache.put(cacheKey, fallback.clone()));
    return fallback;
  }

  try {
    const prompt = buildPrompt(word, hint);
    const aiResult = await context.env.AI.run(MODEL, {
      prompt,
      steps: 8,
      seed: hashSeed(hint ? `${word}|${hint}` : word),
    });

    if (!aiResult || typeof aiResult !== 'object' || typeof aiResult.image !== 'string') {
      throw new Error('Workers AI returned unexpected payload');
    }

    const imageBytes = decodeBase64Image(aiResult.image);
    const response = new Response(imageBytes, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': LONG_CACHE,
        'x-word-image-source': 'ai',
        'x-word-image-style': 'realistic-v3',
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    const fallback = fallbackResponse(word, hint, 200);
    context.waitUntil(cache.put(cacheKey, fallback.clone()));
    return fallback;
  }
}
