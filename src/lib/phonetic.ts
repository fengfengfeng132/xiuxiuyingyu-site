import { dictationWords } from '../data/dictationWords';

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

const pronunciationCache = new Map<string, PronunciationData>();
let wordAudioPlayer: HTMLAudioElement | null = null;
const LOCAL_NORMAL_WORD_AUDIO_BASE = '/audio/words/us';
const LOCAL_SLOW_WORD_AUDIO_BASE = '/audio/words/us-slow';
const localNormalWordAudioMap = new Map(
  dictationWords.map((item) => {
    const key = item.word.trim().toLowerCase();
    return [key, `${LOCAL_NORMAL_WORD_AUDIO_BASE}/${encodeURIComponent(key)}.wav`] as const;
  }),
);
const localSlowWordAudioMap = new Map(
  dictationWords.map((item) => {
    const key = item.word.trim().toLowerCase();
    return [key, `${LOCAL_SLOW_WORD_AUDIO_BASE}/${encodeURIComponent(key)}.wav`] as const;
  }),
);

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
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

  return (usCandidate ?? candidates[0]).text?.trim() ?? null;
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

function getWordAudioPlayer(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!wordAudioPlayer) {
    wordAudioPlayer = new Audio();
    wordAudioPlayer.preload = 'auto';
  }
  return wordAudioPlayer;
}

export function stopUsWordAudioPlayback(): void {
  const player = getWordAudioPlayer();
  if (!player) return;

  player.pause();
  player.currentTime = 0;
}

export async function playUsWordAudio(word: string, rate = 1): Promise<boolean> {
  const url = await fetchUsAudioUrl(word);
  const player = getWordAudioPlayer();

  if (!url || !player) return false;

  try {
    player.pause();
    player.currentTime = 0;
    if (player.src !== url) {
      player.src = url;
    }
    player.playbackRate = rate;
    await player.play();
    return true;
  } catch {
    return false;
  }
}

export async function playLocalUsWordAudio(word: string): Promise<boolean> {
  const url = fetchLocalUsAudioUrl(word);
  const player = getWordAudioPlayer();

  if (!url || !player) return false;

  try {
    player.pause();
    player.currentTime = 0;
    if (player.src !== url) {
      player.src = url;
    }
    player.playbackRate = 1;
    await player.play();
    return true;
  } catch {
    return false;
  }
}

export async function playLocalUsSlowWordAudio(word: string): Promise<boolean> {
  const url = fetchLocalUsSlowAudioUrl(word);
  const player = getWordAudioPlayer();

  if (!url || !player) return false;

  try {
    player.pause();
    player.currentTime = 0;
    if (player.src !== url) {
      player.src = url;
    }
    player.playbackRate = 1;
    await player.play();
    return true;
  } catch {
    return false;
  }
}
