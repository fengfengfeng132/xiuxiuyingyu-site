import { vocabularyWords } from '../data/dictationWords';
import { questionBankLocalAudioEntries } from '../data/questionBankLocalAudio';

const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

interface RawPhonetic {
  text?: string;
  audio?: string;
}

interface RawEntry {
  phonetic?: string;
  phonetics?: RawPhonetic[];
}

interface PronunciationData {
  phonetic: string | null;
  audioUrl: string | null;
}

export type WordAudioPlaybackResult =
  | { ok: true; reason: 'played' }
  | { ok: false; reason: 'missing' | 'stale' | 'failed' | 'blocked' };
type WordAudioFailureReason = Extract<WordAudioPlaybackResult, { ok: false }>['reason'];

const pronunciationCache = new Map<string, PronunciationData>();
let wordAudioPlayer: HTMLAudioElement | null = null;
let wordAudioRequestId = 0;
let failedAudioUrl: string | null = null;
const LOCAL_NORMAL_WORD_AUDIO_BASE = '/audio/words/us';
const LOCAL_SLOW_WORD_AUDIO_BASE = '/audio/words/us-slow';
const localAudioWarmupCache = new Map<string, Promise<boolean>>();
const localNormalWordAudioMap = new Map(
  vocabularyWords.map((item) => {
    const key = item.audioKey.trim().toLowerCase();
    const fileName = item.audioKey.trim();
    return [key, `${LOCAL_NORMAL_WORD_AUDIO_BASE}/${encodeURIComponent(fileName)}.wav`] as const;
  }),
);
const localSlowWordAudioMap = new Map(
  vocabularyWords.map((item) => {
    const key = item.audioKey.trim().toLowerCase();
    const fileName = item.audioKey.trim();
    return [key, `${LOCAL_SLOW_WORD_AUDIO_BASE}/${encodeURIComponent(fileName)}.wav`] as const;
  }),
);
const localQuestionBankAudioMap = new Map(
  questionBankLocalAudioEntries.map((item) => {
    const key = normalizeAudioText(item.text);
    return [key, item] as const;
  }),
);
const localExampleAudioKeys = new Set(
  vocabularyWords.flatMap((word) => word.examples?.map((example) => example.audioKey) ?? []),
);

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function normalizeAudioText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function nextWordAudioRequestId(): number {
  wordAudioRequestId += 1;
  return wordAudioRequestId;
}

function isLatestWordAudioRequest(requestId: number): boolean {
  return requestId === wordAudioRequestId;
}

function toAbsoluteAudioUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).toString();
}

export function classifyWordAudioFailure(error: unknown, latestRequest: boolean): WordAudioFailureReason {
  if (!latestRequest) return 'stale';

  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'stale';
  }

  // The browser refused to start sound (autoplay policy). The file itself is fine, so callers that
  // started playback automatically stay quiet; a tap that gets refused is still reported.
  if ((error as { name?: unknown } | null)?.name === 'NotAllowedError') {
    return 'blocked';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('interrupted') ||
      message.includes('pause()') ||
      message.includes('new load request') ||
      message.includes('aborted')
    ) {
      return 'stale';
    }
  }

  return 'failed';
}

export function getLocalSlowWordAudioFeedback(result: WordAudioPlaybackResult): string {
  if (result.ok || result.reason === 'stale') return '';
  if (result.reason === 'missing') return '当前单词暂无本地慢速语音。';
  return '本地慢速语音暂时没播出来，请再试一次。';
}

export function getLocalWordAudioFeedback(result: WordAudioPlaybackResult): string {
  if (result.ok || result.reason === 'stale') return '';
  if (result.reason === 'missing') return '当前单词暂无本地语音。';
  return '本地语音暂时没播出来，请再试一次。';
}

function isUsAudio(audio: string): boolean {
  const normalized = audio.toLowerCase();
  return normalized.includes('/us') || normalized.includes('-us') || normalized.includes('_us');
}

function normalizeAudioUrl(audio?: string): string | null {
  if (!audio || audio.trim().length === 0) return null;
  if (audio.startsWith('//')) return `https:${audio}`;
  return audio;
}

export function normalizePhoneticForDisplay(phonetic: string): string {
  return phonetic.replaceAll('ɹ', 'r');
}

function collectCandidates(entries: RawEntry[]): RawPhonetic[] {
  const candidates: RawPhonetic[] = [];

  entries.forEach((entry) => {
    if (entry.phonetics?.length) {
      candidates.push(...entry.phonetics);
    }

    if (typeof entry.phonetic === 'string' && entry.phonetic.trim().length > 0) {
      candidates.push({ text: entry.phonetic });
    }
  });

  return candidates;
}

function pickUsPhonetic(entries: RawEntry[]): string | null {
  const candidates = collectCandidates(entries).filter(
    (item) => typeof item.text === 'string' && item.text.trim().length > 0,
  );

  if (!candidates.length) return null;

  const usCandidate = candidates.find((item) => {
    const audio = item.audio?.toLowerCase() ?? '';
    return isUsAudio(audio);
  });

  const phonetic = (usCandidate ?? candidates[0]).text?.trim();
  return phonetic ? normalizePhoneticForDisplay(phonetic) : null;
}

function pickUsAudioUrl(entries: RawEntry[]): string | null {
  const candidates = collectCandidates(entries)
    .map((item) => normalizeAudioUrl(item.audio))
    .filter((item): item is string => Boolean(item));

  if (!candidates.length) return null;

  const usCandidate = candidates.find((audio) => isUsAudio(audio));
  return usCandidate ?? candidates[0];
}

async function fetchUsPronunciation(word: string): Promise<PronunciationData> {
  const key = normalizeWord(word);
  if (!key) {
    return { phonetic: null, audioUrl: null };
  }

  if (pronunciationCache.has(key)) {
    return pronunciationCache.get(key) ?? { phonetic: null, audioUrl: null };
  }

  try {
    const response = await fetch(`${DICTIONARY_API}/${encodeURIComponent(key)}`);
    if (!response.ok) {
      const empty = { phonetic: null, audioUrl: null };
      pronunciationCache.set(key, empty);
      return empty;
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      const empty = { phonetic: null, audioUrl: null };
      pronunciationCache.set(key, empty);
      return empty;
    }

    const entries = data as RawEntry[];
    const pronunciation = {
      phonetic: pickUsPhonetic(entries),
      audioUrl: pickUsAudioUrl(entries),
    };
    pronunciationCache.set(key, pronunciation);
    return pronunciation;
  } catch {
    const empty = { phonetic: null, audioUrl: null };
    pronunciationCache.set(key, empty);
    return empty;
  }
}

export async function fetchUsPhonetic(word: string): Promise<string | null> {
  const pronunciation = await fetchUsPronunciation(word);
  return pronunciation.phonetic;
}

export async function fetchUsAudioUrl(word: string): Promise<string | null> {
  const pronunciation = await fetchUsPronunciation(word);
  return pronunciation.audioUrl;
}

export function fetchLocalUsAudioUrl(word: string): string | null {
  return localNormalWordAudioMap.get(normalizeWord(word)) ?? null;
}

export function fetchLocalUsSlowAudioUrl(word: string): string | null {
  return localSlowWordAudioMap.get(normalizeWord(word)) ?? null;
}

export function fetchLocalExampleAudioUrl(audioKey: string, rate = 1): string | null {
  if (!localExampleAudioKeys.has(audioKey)) return null;
  const variant = rate < 1 ? 'us-slow' : 'us';
  return `/audio/examples/${variant}/${encodeURIComponent(audioKey)}.wav`;
}

export function fetchLocalQuestionBankAudioUrl(text: string, rate = 1): string | null {
  const entry = localQuestionBankAudioMap.get(normalizeAudioText(text));
  if (!entry) return null;
  return rate < 1 ? entry.slow : entry.normal;
}

function preloadAudioUrl(url: string | null): Promise<boolean> {
  if (!url || typeof window === 'undefined') return Promise.resolve(false);

  const absoluteUrl = toAbsoluteAudioUrl(url);
  const cached = localAudioWarmupCache.get(absoluteUrl);
  if (cached) return cached;

  const warmupPromise = new Promise<boolean>((resolve) => {
    const probe = new Audio();
    let settled = false;

    const cleanup = () => {
      probe.onloadeddata = null;
      probe.oncanplaythrough = null;
      probe.onerror = null;
    };

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    probe.preload = 'auto';
    probe.onloadeddata = () => settle(true);
    probe.oncanplaythrough = () => settle(true);
    probe.onerror = () => settle(false);
    probe.src = absoluteUrl;
    probe.load();

    window.setTimeout(() => {
      settle(probe.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    }, 4000);
  }).then((ok) => {
    if (!ok) {
      localAudioWarmupCache.delete(absoluteUrl);
    }
    return ok;
  });

  localAudioWarmupCache.set(absoluteUrl, warmupPromise);
  return warmupPromise;
}

export function preloadLocalUsSlowWordAudio(word: string): Promise<boolean> {
  return preloadAudioUrl(fetchLocalUsSlowAudioUrl(word));
}

export function preloadLocalQuestionBankAudio(text: string, rate = 1): Promise<boolean> {
  return preloadAudioUrl(fetchLocalQuestionBankAudioUrl(text, rate));
}

function getWordAudioPlayer(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!wordAudioPlayer) {
    wordAudioPlayer = new Audio();
    wordAudioPlayer.preload = 'auto';
  }
  return wordAudioPlayer;
}

export function stopUsWordAudioPlayback(): void {
  nextWordAudioRequestId();
  const player = getWordAudioPlayer();
  if (!player) return;

  player.pause();
  player.currentTime = 0;
}

async function playAudioUrl(url: string | null, requestId: number): Promise<WordAudioPlaybackResult> {
  if (!url) return { ok: false, reason: 'missing' };
  const player = getWordAudioPlayer();
  if (!player) return { ok: false, reason: 'failed' };

  try {
    const absoluteUrl = toAbsoluteAudioUrl(url);
    player.pause();
    player.currentTime = 0;
    // After a failed load the element stays in an error state; assigning the same URL again is the only way to retry.
    if (player.src !== absoluteUrl || player.error || failedAudioUrl === absoluteUrl) {
      player.src = absoluteUrl;
      player.load();
    }
    failedAudioUrl = null;
    player.playbackRate = 1;
    await player.play();
    if (!isLatestWordAudioRequest(requestId)) {
      return { ok: false, reason: 'stale' };
    }
    return { ok: true, reason: 'played' };
  } catch (error) {
    const reason = classifyWordAudioFailure(error, isLatestWordAudioRequest(requestId));
    if (reason === 'failed') failedAudioUrl = toAbsoluteAudioUrl(url);
    return { ok: false, reason };
  }
}

export async function playUsWordAudio(word: string, rate = 1): Promise<WordAudioPlaybackResult> {
  const requestId = nextWordAudioRequestId();
  const localUrl = rate < 1
    ? fetchLocalUsSlowAudioUrl(word) ?? fetchLocalQuestionBankAudioUrl(word, rate)
    : fetchLocalUsAudioUrl(word) ?? fetchLocalQuestionBankAudioUrl(word, rate);
  if (localUrl) return playAudioUrl(localUrl, requestId);
  if (rate < 1) return { ok: false, reason: 'missing' };

  const url = await fetchUsAudioUrl(word);
  if (!isLatestWordAudioRequest(requestId)) {
    return { ok: false, reason: 'stale' };
  }
  return playAudioUrl(url, requestId);
}

export async function playLocalUsWordAudio(word: string): Promise<WordAudioPlaybackResult> {
  const requestId = nextWordAudioRequestId();
  const url = fetchLocalUsAudioUrl(word);
  if (!url) return { ok: false, reason: 'missing' };
  return playAudioUrl(url, requestId);
}

export async function playLocalUsSlowWordAudio(word: string): Promise<WordAudioPlaybackResult> {
  const requestId = nextWordAudioRequestId();
  const url = fetchLocalUsSlowAudioUrl(word);
  if (!url) return { ok: false, reason: 'missing' };
  return playAudioUrl(url, requestId);
}

export async function playLocalQuestionBankAudio(text: string, rate = 1): Promise<WordAudioPlaybackResult> {
  const requestId = nextWordAudioRequestId();
  const url = fetchLocalQuestionBankAudioUrl(text, rate);
  if (!url) return { ok: false, reason: 'missing' };
  return playAudioUrl(url, requestId);
}

export async function playLocalExampleAudio(audioKey: string, rate = 1): Promise<WordAudioPlaybackResult> {
  const requestId = nextWordAudioRequestId();
  return playAudioUrl(fetchLocalExampleAudioUrl(audioKey, rate), requestId);
}
