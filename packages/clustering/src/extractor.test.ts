import { describe, it, expect } from 'vitest';
import { Pipeline, type ThemeItem, type NormalizedReview } from '@reviewpipe/core';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { ClusteringThemeExtractor } from './extractor.js';

const SHIPPING = [
  'shipping was very slow',
  'my shipping arrived late',
  'slow shipping again this time',
  'shipping delayed for weeks',
];
const QUALITY = [
  'the quality is poor',
  'terrible quality material',
  'cheap quality overall',
  'bad build quality here',
];

function items(withEmbeddings: boolean): ThemeItem[] {
  const build = (
    text: string,
    id: string,
    embedding: number[],
    sentiment: number,
  ): ThemeItem => ({
    review: { id, text, source: 't' },
    sentiment,
    ...(withEmbeddings ? { embedding } : {}),
  });
  return [
    ...SHIPPING.map((t, i) => build(t, `s${i}`, [1, 0], -0.5)),
    ...QUALITY.map((t, i) => build(t, `q${i}`, [0, 1], -0.3)),
  ];
}

function byLabel(extractor: ClusteringThemeExtractor, input: ThemeItem[]) {
  const themes = extractor.extract(input);
  return new Map(themes.map((theme) => [theme.label, theme]));
}

describe('ClusteringThemeExtractor — embedding mode', () => {
  it('separates two obvious topics into labeled themes', () => {
    const themes = new ClusteringThemeExtractor({ k: 2, exampleCount: 10 }).extract(
      items(true),
    );
    const labels = themes.map((t) => t.label).sort();

    expect(themes).toHaveLength(2);
    expect(labels).toEqual(['quality', 'shipping']);

    const shipping = themes.find((t) => t.label === 'shipping');
    const quality = themes.find((t) => t.label === 'quality');
    expect(shipping?.mentions).toBe(4);
    expect(shipping?.exampleReviewIds.every((id) => id.startsWith('s'))).toBe(true);
    expect(quality?.exampleReviewIds.every((id) => id.startsWith('q'))).toBe(true);
  });

  it('carries each theme’s mean sentiment', () => {
    const themes = byLabel(new ClusteringThemeExtractor({ k: 2 }), items(true));
    expect(themes.get('shipping')?.sentiment).toBeCloseTo(-0.5);
    expect(themes.get('quality')?.sentiment).toBeCloseTo(-0.3);
  });
});

describe('ClusteringThemeExtractor — keyword fallback (no embeddings)', () => {
  it('still separates topics by keyword when embeddings are absent', () => {
    const themes = new ClusteringThemeExtractor({ k: 2, exampleCount: 10 }).extract(
      items(false),
    );
    const labels = themes.map((t) => t.label).sort();

    expect(labels).toEqual(['quality', 'shipping']);
    const shipping = themes.find((t) => t.label === 'shipping');
    expect(shipping?.exampleReviewIds.every((id) => id.startsWith('s'))).toBe(true);
  });
});

describe('ClusteringThemeExtractor — edge cases', () => {
  it('returns no themes for empty input', () => {
    expect(new ClusteringThemeExtractor().extract([])).toEqual([]);
  });

  it('produces a single theme for a one-item corpus', () => {
    const themes = new ClusteringThemeExtractor().extract([
      {
        review: { id: 'a', text: 'great shipping experience', source: 't' },
        sentiment: 0.5,
      },
    ]);
    expect(themes).toHaveLength(1);
    expect(themes[0]?.mentions).toBe(1);
  });
});

describe('ClusteringThemeExtractor — through the pipeline', () => {
  it('populates result.themes with the lexicon provider (keyword fallback)', async () => {
    const reviews: NormalizedReview[] = [...SHIPPING, ...QUALITY].map((text, i) => ({
      id: `r${i}`,
      text,
      source: 't',
    }));

    const out = await new Pipeline()
      .source({ parse: () => reviews })
      .provider(new LexiconProvider())
      .themes(new ClusteringThemeExtractor({ k: 2 }))
      .run(null);
    if (typeof out === 'string' || out instanceof Uint8Array)
      throw new Error('unexpected output');

    const labels = out.themes.map((t) => t.label).sort();
    expect(labels).toEqual(['quality', 'shipping']);
    expect(out.errors).toEqual([]);
  });
});
