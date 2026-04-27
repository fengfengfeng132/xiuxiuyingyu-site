import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dictationPageSource = readFileSync(new URL('../src/pages/DictationPage.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

describe('dictation visual layout', () => {
  it('keeps the dog illustration outside the scrollable word card', () => {
    const dogIndex = dictationPageSource.indexOf('className="lesson-dog-image"');
    const wordCardStart = dictationPageSource.indexOf('<section className="lesson-word-card">');
    const wordCardEnd = dictationPageSource.indexOf('</section>', wordCardStart);

    expect(dogIndex).toBeGreaterThan(-1);
    expect(wordCardStart).toBeGreaterThan(-1);
    expect(wordCardEnd).toBeGreaterThan(wordCardStart);
    expect(dogIndex < wordCardStart || dogIndex > wordCardEnd).toBe(true);
  });

  it('keeps the dog illustration in the page background layer', () => {
    expect(stylesheet).toMatch(/\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*position:\s*absolute;/s);
    expect(stylesheet).toMatch(/\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*z-index:\s*1;/s);
    expect(stylesheet).toMatch(/\.lesson-audio-row\s*{[^}]*z-index:\s*2;/s);
  });

  it('anchors the large-screen dog beside the grass heart instead of the bottom UI', () => {
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*right:\s*24px;/);
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*top:\s*900px;/);
    expect(stylesheet).not.toMatch(/@media \(min-width:\s*768px\)[\s\S]*?\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*bottom:/);
  });

  it('keeps the dog below interactive choice content', () => {
    expect(stylesheet).toMatch(/\.dictation-lesson-page\s*>\s*\.lesson-dog-image\s*{[^}]*z-index:\s*1;/s);
    expect(stylesheet).toMatch(/\.lesson-choice-grid\s*{[^}]*z-index:\s*2;/s);
  });

  it('keeps the large-screen action bar in content flow on short viewports', () => {
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\) and \(max-height:\s*900px\)\s*{[\s\S]*?\.lesson-bottom-action\s*{[^}]*position:\s*relative;/);
    expect(stylesheet).toMatch(/@media \(min-width:\s*768px\) and \(max-height:\s*900px\)\s*{[\s\S]*?\.lesson-bottom-action\s*{[^}]*bottom:\s*auto;/);
  });
});
