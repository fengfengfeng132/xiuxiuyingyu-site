import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dictationPageSource = readFileSync(new URL('../src/pages/DictationPage.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

describe('dictation spell input visibility', () => {
  it('renders the listen-and-type field only in the spelling step', () => {
    expect(dictationPageSource).toContain('{isSpellStep ? (');
    expect(dictationPageSource).toContain('className="lesson-spell-field"');
    expect(dictationPageSource).not.toContain('className="lesson-answer-placeholder"');
  });

  it('gives the large-screen spelling input enough room for children to type', () => {
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.lesson-spell-field\s*{[^}]*width:\s*min\(820px,\s*100%\);/);
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.lesson-spell-field\s*{[^}]*min-height:\s*132px;/);
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.lesson-spell-field input\s*{[^}]*font-size:\s*46px;/);
  });
});
