import { describe, it, expect } from 'vitest';
import { Pipeline, type NormalizedReview, type SourceAdapter } from '@reviewpipe/core';
import { LexiconProvider } from './provider.js';

describe('LexiconProvider', () => {
  it('declares sentiment-only capabilities', () => {
    expect(new LexiconProvider().capabilities).toEqual({
      sentiment: true,
      embeddings: false,
      summarization: false,
      customPrompts: false,
    });
  });

  it('classifies a review by its text', () => {
    const provider = new LexiconProvider();
    const review: NormalizedReview = {
      id: 'r1',
      text: 'Absolutely love this, excellent quality!',
      source: 'test',
    };
    expect(provider.classifySentiment(review).label).toBe('positive');
  });
});

describe('LexiconProvider — end to end through the pipeline', () => {
  const reviews: NormalizedReview[] = [
    {
      id: 'a',
      text: 'Love it, excellent quality and fast shipping!',
      rating: 5,
      date: '2026-01-02',
      source: 't',
    },
    {
      id: 'b',
      text: 'Terrible, broke immediately. Complete waste of money.',
      rating: 1,
      date: '2026-01-03',
      source: 't',
    },
    {
      id: 'c',
      text: 'The box arrived on Tuesday.',
      rating: 3,
      date: '2026-01-04',
      source: 't',
    },
    {
      id: 'd',
      text: 'Great value, very happy, would recommend.',
      rating: 5,
      date: '2026-02-01',
      source: 't',
    },
    { id: 'e', text: 'Five stars!', rating: 5, date: '2026-02-02', source: 't' },
  ];

  const arrayAdapter: SourceAdapter = { parse: () => reviews };

  it('produces a valid AnalysisResult with sensible sentiment', async () => {
    const out = await new Pipeline()
      .source(arrayAdapter)
      .provider(new LexiconProvider())
      .run(null);
    if (typeof out === 'string' || out instanceof Uint8Array) {
      throw new Error('expected an AnalysisResult');
    }

    expect(out.schemaVersion).toBe('1.0.0');
    expect(out.overallSentiment.reviewCount).toBe(5);
    expect(out.overallSentiment.positive).toBeGreaterThanOrEqual(2);
    expect(out.overallSentiment.negative).toBeGreaterThanOrEqual(1);
    expect(out.overallSentiment.score).toBeGreaterThan(0);
    expect(out.errors).toEqual([]);
    // Two calendar months of dated reviews.
    expect(out.trend).toHaveLength(2);
    // Themes stay empty until clustering (Phase 7).
    expect(out.themes).toEqual([]);
  });

  it('does not produce a summary, since the provider cannot summarize', async () => {
    const out = await new Pipeline()
      .source(arrayAdapter)
      .provider(new LexiconProvider())
      .run(null);
    if (typeof out === 'string' || out instanceof Uint8Array)
      throw new Error('unexpected output');
    expect(out.summary).toBeUndefined();
  });
});
