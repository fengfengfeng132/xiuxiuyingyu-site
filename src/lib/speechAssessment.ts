interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionAttempt {
  ok: boolean;
  transcript: string;
  error?: string;
}

export interface SpokenAssessment {
  passed: boolean;
  score: number;
  normalizedTarget: string;
  normalizedTranscript: string;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as typeof window & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export function normalizeEnglishSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/[-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(source: string, target: string): number {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  const prev = Array.from({ length: target.length + 1 }, (_, index) => index);
  const curr = new Array<number>(target.length + 1).fill(0);

  for (let row = 1; row <= source.length; row += 1) {
    curr[0] = row;
    for (let col = 1; col <= target.length; col += 1) {
      const substitutionCost = source[row - 1] === target[col - 1] ? 0 : 1;
      curr[col] = Math.min(
        prev[col] + 1,
        curr[col - 1] + 1,
        prev[col - 1] + substitutionCost,
      );
    }
    for (let col = 0; col <= target.length; col += 1) {
      prev[col] = curr[col];
    }
  }

  return prev[target.length];
}

function computeTokenCoverage(target: string, spoken: string): number {
  const targetTokens = target.split(' ').filter(Boolean);
  const spokenTokens = spoken.split(' ').filter(Boolean);
  if (!targetTokens.length || !spokenTokens.length) return 0;

  let matched = 0;
  const usedIndexes = new Set<number>();
  targetTokens.forEach((token) => {
    const index = spokenTokens.findIndex((candidate, candidateIndex) => candidate === token && !usedIndexes.has(candidateIndex));
    if (index >= 0) {
      usedIndexes.add(index);
      matched += 1;
    }
  });

  return matched / targetTokens.length;
}

export function assessSpokenText(target: string, transcript: string): SpokenAssessment {
  const normalizedTarget = normalizeEnglishSpeechText(target);
  const normalizedTranscript = normalizeEnglishSpeechText(transcript);
  if (!normalizedTarget || !normalizedTranscript) {
    return {
      passed: false,
      score: 0,
      normalizedTarget,
      normalizedTranscript,
    };
  }

  const maxLen = Math.max(normalizedTarget.length, normalizedTranscript.length);
  const distance = levenshteinDistance(normalizedTarget, normalizedTranscript);
  const charSimilarity = maxLen === 0 ? 1 : Math.max(0, 1 - distance / maxLen);
  const tokenCoverage = computeTokenCoverage(normalizedTarget, normalizedTranscript);
  const targetTokenCount = normalizedTarget.split(' ').filter(Boolean).length;
  const scoreRaw = targetTokenCount <= 2
    ? Math.max(charSimilarity, tokenCoverage)
    : Math.min(1, charSimilarity * 0.65 + tokenCoverage * 0.35);
  const score = Math.round(scoreRaw * 100);
  const passLine = targetTokenCount <= 2 ? 78 : 70;
  const passed =
    score >= passLine ||
    normalizedTranscript.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedTranscript);

  return {
    passed,
    score,
    normalizedTarget,
    normalizedTranscript,
  };
}

export function getSpeechRecognitionErrorMessage(error?: string): string {
  switch (error) {
    case 'audio-capture':
      return '没有检测到麦克风，请检查设备或权限。';
    case 'not-allowed':
      return '没有麦克风权限，请先允许浏览器访问麦克风。';
    case 'no-speech':
      return '没有听到清晰语音，请靠近麦克风再读一次。';
    case 'network':
      return '语音识别网络异常，请稍后重试。';
    case 'aborted':
      return '语音识别已中断，请再试一次。';
    case 'timeout':
      return '等待语音超时，请点击按钮后尽快朗读。';
    default:
      return '语音识别失败，请重试。';
  }
}

export function recognizeSpeechOnce(
  lang = 'en-US',
  timeoutMs = 7000,
): Promise<SpeechRecognitionAttempt> {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    return Promise.resolve({
      ok: false,
      transcript: '',
      error: 'not-supported',
    });
  }

  return new Promise((resolve) => {
    const recognition = new Ctor();
    let settled = false;
    let timer: number | null = null;

    const finalize = (result: SpeechRecognitionAttempt) => {
      if (settled) return;
      settled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // ignore stop failures after recognition finished
      }
      resolve(result);
    };

    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const alternatives: string[] = [];
      for (let resultIndex = 0; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results.item(resultIndex);
        if (result.length > 0) {
          alternatives.push(result.item(0).transcript);
        }
      }

      const transcript = alternatives.join(' ').trim();
      if (!transcript) {
        finalize({
          ok: false,
          transcript: '',
          error: 'no-speech',
        });
        return;
      }

      finalize({
        ok: true,
        transcript,
      });
    };

    recognition.onerror = (event) => {
      finalize({
        ok: false,
        transcript: '',
        error: event.error ?? 'error',
      });
    };

    recognition.onend = () => {
      finalize({
        ok: false,
        transcript: '',
        error: 'no-speech',
      });
    };

    timer = window.setTimeout(() => {
      finalize({
        ok: false,
        transcript: '',
        error: 'timeout',
      });
    }, timeoutMs);

    try {
      recognition.start();
    } catch {
      finalize({
        ok: false,
        transcript: '',
        error: 'start-failed',
      });
    }
  });
}
