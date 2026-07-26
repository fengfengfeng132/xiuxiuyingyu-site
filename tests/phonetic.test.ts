import { afterEach, describe, expect, it, vi } from 'vitest';
import { dictationWords } from '../src/data/dictationWords';
import {
  classifyWordAudioFailure,
  getLocalSlowWordAudioFeedback,
  getLocalWordAudioFeedback,
  normalizePhoneticForDisplay,
  playLocalQuestionBankAudio,
  playLocalUsSlowWordAudio,
  playLocalUsWordAudio,
} from '../src/lib/phonetic';

afterEach(() => {
  vi.unstubAllGlobals();
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
    let playCalls = 0;

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
        playCalls += 1;
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

    expect(playCalls).toBe(3);
  });
});
