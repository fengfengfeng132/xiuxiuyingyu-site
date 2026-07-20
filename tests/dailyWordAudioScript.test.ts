import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('daily word audio generation script', () => {
  it('reads the structured JSON word list as UTF-8 so audio variants stay intact', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toMatch(/Get-Content\s+-LiteralPath\s+\$dictationPath\s+-Raw\s+-Encoding\s+UTF8/u);
    expect(script).toContain('ConvertFrom-Json');
    expect(script).toContain('dictationWords.json');
  });

  it('falls back to SAPI when System.Speech cannot select the English voice', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toContain('SAPI.SpVoice');
    expect(script).toContain('SAPI.SpFileStream');
  });

  it('uses each entry audio key and spoken text instead of colliding on duplicate spellings', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toContain('$entry.audioKey');
    expect(script).toContain('$entry.spokenText');
  });
});
