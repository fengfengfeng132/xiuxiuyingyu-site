import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import words from '../src/data/dictationWords.json';

const examples = words.flatMap((word) => word.examples);

function readWave(relativePath: string) {
  const bytes = readFileSync(resolve(relativePath));
  let format: { audioFormat: number; fmtSize: number; bitsPerSample: number; byteRate: number } | undefined;
  let samples: Buffer | undefined;

  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Invalid WAV container: ${relativePath}`);
  }

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkName = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    if (chunkName === 'fmt ') {
      format = {
        audioFormat: bytes.readUInt16LE(offset + 8),
        fmtSize: chunkSize,
        bitsPerSample: bytes.readUInt16LE(offset + 22),
        byteRate: bytes.readUInt32LE(offset + 16),
      };
    }
    if (chunkName === 'data') samples = bytes.subarray(offset + 8, offset + 8 + chunkSize);
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!format || !samples || format.byteRate === 0 || format.bitsPerSample !== 16) {
    throw new Error(`Missing 16-bit WAV audio: ${relativePath}`);
  }

  let peak = 0;
  for (let offset = 0; offset + 2 <= samples.length; offset += 2) {
    peak = Math.max(peak, Math.abs(samples.readInt16LE(offset)));
  }
  return { ...format, peak, duration: samples.length / format.byteRate };
}

describe('daily example audio assets', () => {
  it('ships exactly one normal and one slow recording for every example', () => {
    const expectedFiles = examples.map((example) => `${example.audioKey}.wav`).sort();
    expect(new Set(expectedFiles).size).toBe(examples.length);
    for (const variant of ['us', 'us-slow']) {
      const actualFiles = readdirSync(resolve('public/audio/examples', variant)).filter((name) => name.endsWith('.wav')).sort();
      expect(actualFiles).toEqual(expectedFiles);
    }
  });

  for (const example of examples) {
    it(`keeps ${example.audioKey} playable, audible and slower in its separate slow recording`, () => {
      const normal = readWave(`public/audio/examples/us/${example.audioKey}.wav`);
      const slow = readWave(`public/audio/examples/us-slow/${example.audioKey}.wav`);
      for (const audio of [normal, slow]) {
        expect(audio.audioFormat).toBe(1);
        expect(audio.fmtSize).toBe(16);
        expect(audio.peak).toBeGreaterThan(0);
        expect(audio.peak).toBeLessThan(32767);
      }
      expect(slow.duration).toBeGreaterThan(normal.duration * 1.1);
    });
  }
});
