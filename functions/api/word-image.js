const MODEL = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const LONG_CACHE = 'public, max-age=1209600, s-maxage=1209600';
const SHORT_CACHE = 'public, max-age=900, s-maxage=900';

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

function buildFallbackSvg(word) {
  const safeWord = escapeXml(word);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f5f8ff"/>
      <stop offset="100%" stop-color="#eefaf3"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="640" height="640" rx="28" fill="url(#bg)"/>
  <rect x="30" y="30" width="580" height="580" rx="24" fill="#ffffff" stroke="#d7e2ff" stroke-width="4"/>
  <circle cx="320" cy="270" r="110" fill="#e8f0ff" stroke="#bfd3ff" stroke-width="6"/>
  <rect x="265" y="215" width="110" height="110" rx="18" fill="#c5d8ff"/>
  <text x="320" y="500" text-anchor="middle" font-size="56" font-family="Arial, sans-serif" font-weight="700" fill="#254b91">${safeWord}</text>
</svg>`;
}

function fallbackResponse(word, status = 200) {
  const svg = buildFallbackSvg(word);
  return new Response(svg, {
    status,
    headers: {
      'content-type': 'image/svg+xml; charset=UTF-8',
      'cache-control': SHORT_CACHE,
      'x-word-image-source': 'fallback',
      'x-word-image-style': 'fallback-card',
    },
  });
}

function buildPrompt(word, hint) {
  const hintText = hint ? `Meaning hint: ${hint}.` : '';
  return [
    `Create a realistic educational image for the English word "${word}".`,
    hintText,
    'Single clear subject only, centered composition, natural proportions, realistic textures, soft natural daylight,',
    'plain light background, high detail, child-safe and friendly, suitable for grade-2 vocabulary flashcards.',
    'No text, no letters, no logo, no watermark, no abstract art, no surreal style, no cartoon, no anime.',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAiBinding(env) {
  return Boolean(env && env.AI && typeof env.AI.run === 'function');
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
  cacheUrl.searchParams.set('v', 'ai-v2-realistic');

  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasAiBinding(context.env)) {
    const fallback = fallbackResponse(word);
    context.waitUntil(cache.put(cacheKey, fallback.clone()));
    return fallback;
  }

  try {
    const prompt = buildPrompt(word, hint);
    const negativePrompt = [
      'text',
      'letters',
      'watermark',
      'logo',
      'brand',
      'gore',
      'violence',
      'weapon',
      'horror',
      'blurry',
      'abstract',
      'surreal',
      'cartoon',
      'anime',
      'illustration',
      'painting',
      '3d render',
      'distorted',
      'deformed',
      'extra limbs',
      'low quality',
    ].join(', ');

    const imageStream = await context.env.AI.run(MODEL, {
      prompt,
      negative_prompt: negativePrompt,
      width: 512,
      height: 512,
      num_steps: 28,
      guidance: 8,
      seed: hashSeed(word),
    });

    const response = new Response(imageStream, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': LONG_CACHE,
        'x-word-image-source': 'ai',
        'x-word-image-style': 'realistic-v2',
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    const fallback = fallbackResponse(word, 200);
    context.waitUntil(cache.put(cacheKey, fallback.clone()));
    return fallback;
  }
}