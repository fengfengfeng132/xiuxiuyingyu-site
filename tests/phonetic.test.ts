import { describe, expect, it } from 'vitest';
import { classifyWordAudioFailure, getLocalSlowWordAudioFeedback } from '../src/lib/phonetic';

describe('phonetic', () => {
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
});
