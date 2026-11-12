import { afterEach, describe, expect, it, vi } from 'vitest';
import { archivedDictationWords, dictationWords } from '../src/data/dictationWords';
import {
  classifyWordAudioFailure,
  fetchLocalExampleAudioUrl,
  fetchLocalUsAudioUrl,
  fetchLocalUsSlowAudioUrl,
  getLocalSlowWordAudioFeedback,
  getLocalWordAudioFeedback,
  normalizePhoneticForDisplay,
  playLocalExampleAudio,
  playLocalQuestionBankAudio,
  playLocalUsSlowWordAudio,
  playLocalUsWordAudio,
  playUsWordAudio,
} from '../src/lib/phonetic';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('slow playback safety', () => {
  it('plays base words through independent local variants at normal browser speed', async () => {
    vi.resetModules();
    const played: { src: string; rate: number }[] = [];
    class FakeAudio {
      currentTime = 0;
      playbackRate = 1;
      preload = '';
      src = '';
      load() {}
      pause() {}
      play() { played.push({ src: this.src, rate: this.playbackRate }); return Promise.resolve(); }
    }
    const fetch = vi.fn();
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
    vi.stubGlobal('fetch', fetch);
    const audio = await import('../src/lib/phonetic');

    expect(await audio.playUsWordAudio('hit', 0.75)).toEqual({ ok: true, reason: 'played' });
    expect(await audio.playUsWordAudio('hit', 1)).toEqual({ ok: true, reason: 'played' });
    expect(played).toEqual([
      { src: 'https://example.test/audio/question-bank/us-slow/hit.wav', rate: 1 },
      { src: 'https://example.test/audio/question-bank/us/hit.wav', rate: 1 },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports missing independent slow audio instead of fetching and stretching dictionary audio', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await playUsWordAudio('unlisted-regression-word', 0.75)).toEqual({ ok: false, reason: 'missing' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports playback failure explicitly when a mapped local recording cannot play', async () => {
    vi.resetModules();
    class FailedAudio {
      currentTime = 0;
      playbackRate = 1;
      preload = '';
      src = '';
      load() {}
      pause() {}
      play() { return Promise.reject(new Error('Unable to decode audio')); }
    }
    vi.stubGlobal('Audio', FailedAudio);
    vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
    const audio = await import('../src/lib/phonetic');
    expect(await audio.playUsWordAudio('hit', 0.75)).toEqual({ ok: false, reason: 'failed' });
    expect(audio.getLocalSlowWordAudioFeedback({ ok: false, reason: 'failed' })).not.toBe('');
  });
});

describe('phonetic', () => {
  it('uses a familiar r glyph instead of the reversed-looking IPA glyph for children', () => {
    expect(normalizePhoneticForDisplay('/ˈɹoʊd/')).toBe('/ˈroʊd/');
  });

  it('treats interrupted playback as a stale request instead of a missing file', () => {
    const error = new Error('The play() request was interrupted by a call to pause().');
    expect(classifyWordAudioFailure(error, true)).toBe('stale');
  });

  it('returns stale when a newer playback request has already replaced the current one', () => {
    expect(classifyWordAudioFailure(new Error('anything'), false)).toBe('stale');
  });

  it('only shows the missing-audio message when the word truly has no mapped slow audio', () => {
    expect(getLocalSlowWordAudioFeedback({ ok: false, reason: 'missing' })).toBe('当前单词暂无本地慢速语音。');
    expect(getLocalSlowWordAudioFeedback({ ok: false, reason: 'stale' })).toBe('');
    expect(getLocalSlowWordAudioFeedback({ ok: false, reason: 'failed' })).toBe('本地慢速语音暂时没播出来，请再试一次。');
  });

  it('reports normal local word audio failures without mentioning the dictionary service', () => {
    expect(getLocalWordAudioFeedback({ ok: false, reason: 'missing' })).toBe('当前单词暂无本地语音。');
    expect(getLocalWordAudioFeedback({ ok: false, reason: 'stale' })).toBe('');
    expect(getLocalWordAudioFeedback({ ok: false, reason: 'failed' })).toBe('本地语音暂时没播出来，请再试一次。');
  });

  it('starts local playback synchronously while the iPad click gesture is still active', () => {
    const played: { src: string; rate: number }[] = [];

    class FakeAudio {
      currentTime = 0;
      oncanplaythrough: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onloadeddata: (() => void) | null = null;
      playbackRate = 1;
      preload = '';
      src = '';

      load() {}
      pause() {}
      play() {
        played.push({ src: this.src, rate: this.playbackRate });
        return Promise.resolve();
      }
    }

    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('window', {
      location: { origin: 'https://example.test' },
      setTimeout: () => 1,
    });

    const currentDailyAudioKey = dictationWords[0].audioKey;
    void playLocalUsWordAudio(currentDailyAudioKey);
    void playLocalUsSlowWordAudio(currentDailyAudioKey);
    void playLocalQuestionBankAudio('keyboard');
    const exampleAudioKey = dictationWords[0].examples![0].audioKey;
    void playLocalExampleAudio(exampleAudioKey);
    void playLocalExampleAudio(exampleAudioKey, 0.75);

    expect(played).toHaveLength(5);
    expect(played.at(-2)?.src).toContain(`/audio/examples/us/${exampleAudioKey}.wav`);
    expect(played.at(-1)?.src).toContain(`/audio/examples/us-slow/${exampleAudioKey}.wav`);
    expect(played.every((audio) => audio.rate === 1)).toBe(true);
  });

  it('keeps the archived lesson playable locally after replacing the daily lesson', () => {
    archivedDictationWords.forEach((word) => {
      expect(fetchLocalUsAudioUrl(word.audioKey)).toBe(`/audio/words/us/${encodeURIComponent(word.audioKey)}.wav`);
      expect(fetchLocalUsSlowAudioUrl(word.audioKey)).toBe(`/audio/words/us-slow/${encodeURIComponent(word.audioKey)}.wav`);
    });
  });

  it('only maps example audio keys declared in the vocabulary data', async () => {
    expect(fetchLocalExampleAudioUrl('../undeclared')).toBeNull();
    expect(await playLocalExampleAudio('../undeclared')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('audio retry and autoplay refusal', () => {
  function stubAudio(play: () => Promise<void>) {
    const counters = { loads: 0 };
    class CountingAudio {
      currentTime = 0;
      error: unknown = null;
      playbackRate = 1;
      preload = '';
      src = '';
      load() { counters.loads += 1; }
      pause() {}
      play() { return play(); }
    }
    vi.stubGlobal('Audio', CountingAudio);
    vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
    return counters;
  }

  it('reloads the same recording on the next tap after a failed load', async () => {
    vi.resetModules();
    let failures = 1;
    const counters = stubAudio(() => (failures-- > 0
      ? Promise.reject(new Error('Failed to load because no supported source was found.'))
      : Promise.resolve()));
    const audio = await import('../src/lib/phonetic');
    const audioKey = dictationWords[0].audioKey;

    expect(await audio.playLocalUsWordAudio(audioKey)).toEqual({ ok: false, reason: 'failed' });
    expect(counters.loads).toBe(1);
    expect(await audio.playLocalUsWordAudio(audioKey)).toEqual({ ok: true, reason: 'played' });
    expect(counters.loads).toBe(2);
    expect(await audio.playLocalUsWordAudio(audioKey)).toEqual({ ok: true, reason: 'played' });
    expect(counters.loads).toBe(2);
  });

  it('reports a refused automatic start as blocked and does not treat the file as broken', async () => {
    vi.resetModules();
    let refusals = 1;
    const counters = stubAudio(() => (refusals-- > 0
      ? Promise.reject(new DOMException('play() failed because the user did not interact with the document first.', 'NotAllowedError'))
      : Promise.resolve()));
    const audio = await import('../src/lib/phonetic');
    const audioKey = dictationWords[0].audioKey;

    expect(await audio.playLocalUsWordAudio(audioKey)).toEqual({ ok: false, reason: 'blocked' });
    expect(await audio.playLocalUsWordAudio(audioKey)).toEqual({ ok: true, reason: 'played' });
    expect(counters.loads).toBe(1);
  });

  it('classifies a refused start separately from broken, stale and interrupted playback', () => {
    const refused = new DOMException('not allowed', 'NotAllowedError');
    expect(classifyWordAudioFailure(refused, true)).toBe('blocked');
    expect(classifyWordAudioFailure(refused, false)).toBe('stale');
    expect(classifyWordAudioFailure(new Error('Unable to decode audio'), true)).toBe('failed');
  });

  it('still tells the child when a tap on the play button was refused', () => {
    expect(getLocalWordAudioFeedback({ ok: false, reason: 'blocked' })).toBe('本地语音暂时没播出来，请再试一次。');
    expect(getLocalSlowWordAudioFeedback({ ok: false, reason: 'blocked' })).toBe('本地慢速语音暂时没播出来，请再试一次。');
  });
});
