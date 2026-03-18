const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

interface RawPhonetic {
  text?: string;
  audio?: string;
}

interface RawEntry {
  phonetic?: string;
  phonetics?: RawPhonetic[];
}

const phoneticCache = new Map<string, string | null>();

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function pickUsPhonetic(entries: RawEntry[]): string | null {
  const candidates: RawPhonetic[] = [];

  entries.forEach((entry) => {
    if (entry.phonetics?.length) {
      candidates.push(
        ...entry.phonetics.filter((item) => typeof item.text === 'string' && item.text.trim().length > 0),
      );
    }

    if (typeof entry.phonetic === 'string' && entry.phonetic.trim().length > 0) {
      candidates.push({ text: entry.phonetic });
    }
  });

  if (!candidates.length) return null;

  const usCandidate = candidates.find((item) => {
    const audio = item.audio?.toLowerCase() ?? '';
    return audio.includes('/us') || audio.includes('-us') || audio.includes('_us');
  });

  return (usCandidate ?? candidates[0]).text?.trim() ?? null;
}

export async function fetchUsPhonetic(word: string): Promise<string | null> {
  const key = normalizeWord(word);
  if (!key) return null;

  if (phoneticCache.has(key)) {
    return phoneticCache.get(key) ?? null;
  }

  try {
    const response = await fetch(`${DICTIONARY_API}/${encodeURIComponent(key)}`);
    if (!response.ok) {
      phoneticCache.set(key, null);
      return null;
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      phoneticCache.set(key, null);
      return null;
    }

    const phonetic = pickUsPhonetic(data as RawEntry[]);
    phoneticCache.set(key, phonetic);
    return phonetic;
  } catch {
    phoneticCache.set(key, null);
    return null;
  }
}
