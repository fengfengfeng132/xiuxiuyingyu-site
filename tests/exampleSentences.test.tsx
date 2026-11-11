import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExampleSentences } from '../src/components/ExampleSentences';
import type { ExampleSentence } from '../src/data/dictationWords';

const examples: ExampleSentence[] = [
  { text: 'The students eat lunch.', translation: '学生们吃午饭。', audioKey: 'eat-1', source: 'Word List' },
  { text: 'They eat together.', translation: '他们一起吃饭。', audioKey: 'eat-2', source: 'Unit 2' },
];

describe('example sentence learning card', () => {
  it('omits both English and Chinese clues until an answer is revealed', () => {
    const html = renderToStaticMarkup(<ExampleSentences examples={examples} revealed={false} />);
    expect(html).toBe('');
  });

  it('shows both textbook sentences with their matching translations and sources', () => {
    const html = renderToStaticMarkup(<ExampleSentences examples={examples} revealed />);
    examples.forEach((example) => {
      expect(html).toContain(example.text);
      expect(html).toContain(example.translation);
      expect(html).toContain(example.source);
    });
    expect(html.match(/>听例句</g)).toHaveLength(2);
    expect(html.match(/>慢速听</g)).toHaveLength(2);
  });

  it('provides an accessible toggle for recalling the English from Chinese', () => {
    const html = renderToStaticMarkup(<ExampleSentences examples={examples} revealed />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('遮住英文');
    expect(html).toContain('看着中文试着背');
    expect(html).toContain('lang="en"');
  });

  it('does not add an empty learning card to archived words without examples', () => {
    expect(renderToStaticMarkup(<ExampleSentences revealed />)).toBe('');
    expect(renderToStaticMarkup(<ExampleSentences examples={[]} revealed />)).toBe('');
  });
});
