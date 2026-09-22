import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  SCHEMA_VERSION,
  type NormalizedReview,
  type SourceAdapter,
  type Transformer,
  type AnalysisProvider,
  type Exporter,
  type SentimentResult,
  type AnalysisResult,
} from './index.js';

// Phase 1 has no runtime logic — these tests exist to assert the exported
// types accept the object shapes the rest of the pipeline will build.

describe('schema and interface shapes', () => {
  it('accepts a fully populated and a minimal NormalizedReview', () => {
    const full: NormalizedReview = {
      id: 'r1',
      text: 'Great product, fast shipping.',
      rating: 5,
      date: '2026-01-05',
      author: 'jenna_k',
      productId: 'SKU-1001',
      source: 'fixture',
      raw: { original: 'row' },
    };
    const minimal: NormalizedReview = { id: 'r2', text: '', source: 'fixture' };

    expectTypeOf(full).toMatchTypeOf<NormalizedReview>();
    expectTypeOf(minimal).toMatchTypeOf<NormalizedReview>();
    expect(full.rating).toBe(5);
    expect(minimal.rating).toBeUndefined();
  });

  it('accepts implementations of the four core interfaces', () => {
    const adapter: SourceAdapter = {
      parse: () => [{ id: 'r1', text: 'hi', source: 's' }],
    };
    const transformer: Transformer = {
      transform: (reviews) => reviews,
    };
    const provider: AnalysisProvider = {
      name: 'stub',
      capabilities: {
        sentiment: true,
        embeddings: false,
        summarization: false,
        customPrompts: false,
      },
      classifySentiment: (): SentimentResult => ({ score: 0, label: 'neutral' }),
    };
    const exporter: Exporter = {
      export: (result) => JSON.stringify(result),
    };

    expectTypeOf(adapter).toMatchTypeOf<SourceAdapter>();
    expectTypeOf(transformer).toMatchTypeOf<Transformer>();
    expectTypeOf(provider).toMatchTypeOf<AnalysisProvider>();
    expectTypeOf(exporter).toMatchTypeOf<Exporter>();
    expect(provider.embed).toBeUndefined();
  });

  it('accepts a well-formed AnalysisResult', () => {
    const result: AnalysisResult = {
      schemaVersion: SCHEMA_VERSION,
      overallSentiment: {
        score: 0.2,
        positive: 2,
        neutral: 1,
        negative: 1,
        reviewCount: 4,
      },
      themes: [
        {
          label: 'shipping',
          keywords: ['shipping', 'delivery'],
          mentions: 2,
          sentiment: -0.1,
          exampleReviewIds: ['r1'],
        },
      ],
      trend: [{ period: '2026-01', averageSentiment: 0.2, reviewCount: 4 }],
      flagged: [
        {
          reviewId: 'r3',
          text: 'five stars but broken',
          score: -0.8,
          reason: 'rating/text mismatch',
        },
      ],
      errors: [{ stage: 'provider', message: 'timeout', reviewId: 'r4' }],
    };

    expectTypeOf(result).toMatchTypeOf<AnalysisResult>();
    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.summary).toBeUndefined();
  });
});
