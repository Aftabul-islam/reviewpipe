import { describe, it, expect } from 'vitest';
import { extractKeywords } from './tfidf.js';

describe('extractKeywords', () => {
  it('surfaces distinctive topical terms across documents', () => {
    const documents = [
      'shipping was slow and shipping arrived late',
      'the shipping delay ruined the shipping experience',
      'quality is poor, terrible quality overall',
      'build quality feels cheap, quality control lacking',
    ];

    const terms = extractKeywords(documents, { topN: 5 }).map((k) => k.term);
    expect(terms).toContain('shipping');
    expect(terms).toContain('quality');
  });

  it('excludes stopwords and short tokens', () => {
    const terms = extractKeywords(['the product is a good product and it is nice']).map(
      (k) => k.term,
    );
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('is');
    expect(terms).toContain('product');
  });

  it('respects topN and returns an empty array for empty input', () => {
    expect(extractKeywords([])).toEqual([]);
    expect(extractKeywords(['alpha beta gamma delta epsilon'], { topN: 2 })).toHaveLength(
      2,
    );
  });

  it('ranks by frequency for a single-document corpus instead of collapsing to zero', () => {
    const [top] = extractKeywords(['comfort comfort comfort price price fabric']);
    expect(top?.term).toBe('comfort');
    expect(top?.score).toBeGreaterThan(0);
  });
});
