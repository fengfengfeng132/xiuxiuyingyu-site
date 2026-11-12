import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repoRoot, process.argv[2] ?? 'tmp/question-bank-audio/manifest.json');
const server = await createServer({ root: repoRoot, server: { middlewareMode: true }, appType: 'custom' });

try {
  const { questionBankLocalAudioEntries } = await server.ssrLoadModule('/src/data/questionBankLocalAudio.ts');
  const entries = questionBankLocalAudioEntries.map((entry) => ({
    audioKey: basename(entry.normal, '.wav'),
    spokenText: entry.text,
  }));
  if (entries.length === 0 || new Set(entries.map((entry) => entry.audioKey)).size !== entries.length) {
    throw new Error('Question-bank audio manifest is empty or contains colliding file keys');
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ outputPath, audioPairs: entries.length })}\n`);
} finally {
  await server.close();
}
