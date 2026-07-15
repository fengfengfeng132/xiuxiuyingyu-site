import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('daily word audio generation script', () => {
  it('reads the TypeScript word list as UTF-8 so Unicode word filenames stay intact', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toMatch(/Get-Content\s+-LiteralPath\s+\$dictationPath\s+-Raw\s+-Encoding\s+UTF8/u);
  });

  it('falls back to SAPI when System.Speech cannot select the English voice', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toContain('SAPI.SpVoice');
    expect(script).toContain('SAPI.SpFileStream');
  });

  it('pronounces read as the past tense for the current irregular-verb lesson', () => {
    const script = readFileSync(resolve('tools/New-DailyWordAudio.ps1'), 'utf8');

    expect(script).toContain('$word -eq "read"');
    expect(script).toContain('$spokenText = "red"');
  });
});
