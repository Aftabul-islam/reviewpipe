import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from './pipeline.js';
import type { NormalizedReview } from './schema.js';
import type {
  SourceAdapter,
  Transformer,
  AnalysisProvider,
  Exporter,
  SentimentResult,
  ProviderCapabilities,
} from './interfaces.js';
import type { AnalysisResult } from './result.js';

const CAPS_SENTIMENT_ONLY: ProviderCapabilities = {
  sentiment: true,
  embeddings: false,
  summarization: false,
  customPrompts: false,
};

function arrayAdapter(reviews: NormalizedReview[]): SourceAdapter {
  return { parse: () => reviews };
}

/** Scores by the review's rating so tests can predict labels from fixtures. */
function ratingProvider(overrides: Partial<AnalysisProvider> = {}): AnalysisProvider {
  return {
    name: 'rating-mock',
    capabilities: CAPS_SENTIMENT_ONLY,
    classifySentiment: (review): SentimentResult => {
      const rating = review.rating ?? 3;
      if (rating >= 4) return { score: 0.8, label: 'positive' };
      if (rating <= 2) return { score: -0.8, label: 'negative' };
      return { score: 0, label: 'neutral' };
    },
    ...overrides,
  };
}

function reviews(): NormalizedReview[] {
  return [
    { id: 'a', text: 'love it', rating: 5, date: '2026-01-02', source: 't' },
    { id: 'b', text: 'hate it', rating: 1, date: '2026-01-03', source: 't' },
    { id: 'c', text: 'fine', rating: 3, date: '2026-02-01', source: 't' },
  ];
}

async function runToResult(pipeline: Pipeline, input: unknown): Promise<AnalysisResult> {
  const out = await pipeline.run(input);
  if (typeof out === 'string' || out instanceof Uint8Array) {
    throw new Error('expected an AnalysisResult, got exporter output');
  }
  return out;
}

describe('Pipeline', () => {
  it('runs adapter → provider → aggregation into a valid AnalysisResult', async () => {
    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(ratingProvider()),
      null,
    );

    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.overallSentiment.reviewCount).toBe(3);
    expect(result.overallSentiment.positive).toBe(1);
    expect(result.overallSentiment.negative).toBe(1);
    expect(result.trend).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('isolates a single failing review instead of crashing the batch', async () => {
    const provider = ratingProvider({
      classifySentiment: (review): SentimentResult => {
        if (review.id === 'b') throw new Error('boom');
        return { score: 0.8, label: 'positive' };
      },
    });

    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(provider),
      null,
    );

    expect(result.overallSentiment.reviewCount).toBe(2);
    expect(result.errors).toEqual([
      { stage: 'provider', reviewId: 'b', message: 'boom' },
    ]);
  });

  it('applies transformers in order before analysis', async () => {
    const dropNeutral: Transformer = {
      transform: (rs) => rs.filter((r) => (r.rating ?? 3) !== 3),
    };
    const tagSource: Transformer = {
      transform: (rs) => rs.map((r) => ({ ...r, source: 'tagged' })),
    };

    const capture: NormalizedReview[] = [];
    const provider = ratingProvider({
      classifySentiment: (review): SentimentResult => {
        capture.push(review);
        return { score: 0, label: 'neutral' };
      },
    });

    await runToResult(
      new Pipeline()
        .source(arrayAdapter(reviews()))
        .use(dropNeutral)
        .use(tagSource)
        .provider(provider),
      null,
    );

    expect(capture).toHaveLength(2);
    expect(capture.every((r) => r.source === 'tagged')).toBe(true);
  });

  it('includes a summary only when the provider supports summarization', async () => {
    const withSummary = ratingProvider({
      capabilities: { ...CAPS_SENTIMENT_ONLY, summarization: true },
      summarize: () => 'overall positive',
    });

    const summarized = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(withSummary),
      null,
    );
    expect(summarized.summary).toBe('overall positive');

    const plain = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(ratingProvider()),
      null,
    );
    expect(plain.summary).toBeUndefined();
  });

  it('records a non-fatal error when summarization throws', async () => {
    const provider = ratingProvider({
      capabilities: { ...CAPS_SENTIMENT_ONLY, summarization: true },
      summarize: () => {
        throw new Error('rate limited');
      },
    });

    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(provider),
      null,
    );

    expect(result.summary).toBeUndefined();
    expect(result.overallSentiment.reviewCount).toBe(3);
    expect(result.errors[0]).toMatchObject({ stage: 'provider' });
    expect(result.errors[0]?.message).toContain('rate limited');
  });

  it('degrades gracefully when the provider lacks the sentiment capability', async () => {
    const embeddingsOnly = ratingProvider({
      capabilities: { ...CAPS_SENTIMENT_ONLY, sentiment: false },
    });

    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(embeddingsOnly),
      null,
    );

    expect(result.overallSentiment.reviewCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('passes the result to an exporter and returns its output', async () => {
    const exporter: Exporter = { export: (result) => JSON.stringify(result) };

    const out = await new Pipeline()
      .source(arrayAdapter(reviews()))
      .provider(ratingProvider())
      .export(exporter)
      .run(null);

    expect(typeof out).toBe('string');
    const parsed = JSON.parse(out as string) as AnalysisResult;
    expect(parsed.overallSentiment.reviewCount).toBe(3);
  });

  it('throws when required stages are missing', async () => {
    await expect(new Pipeline().provider(ratingProvider()).run(null)).rejects.toThrow(
      /source adapter/,
    );
    await expect(new Pipeline().source(arrayAdapter([])).run(null)).rejects.toThrow(
      /provider/,
    );
  });
});

describe('Pipeline — theme extraction', () => {
  const CAPS_WITH_EMBEDDINGS: ProviderCapabilities = {
    ...CAPS_SENTIMENT_ONLY,
    embeddings: true,
  };

  function embeddingProvider(
    overrides: Partial<AnalysisProvider> = {},
  ): AnalysisProvider {
    return {
      ...ratingProvider(),
      capabilities: CAPS_WITH_EMBEDDINGS,
      embed: (review) => [review.rating ?? 0, review.text.length],
      ...overrides,
    };
  }

  it('leaves themes empty when no extractor is set', async () => {
    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(ratingProvider()),
      null,
    );
    expect(result.themes).toEqual([]);
  });

  it('feeds the extractor sentiment scores and embeddings, and uses its themes', async () => {
    let received: { sentiment?: number; embedding?: number[]; id: string }[] = [];
    const extractor = {
      extract: (
        items: { review: NormalizedReview; sentiment?: number; embedding?: number[] }[],
      ) => {
        received = items.map((i) => ({
          id: i.review.id,
          sentiment: i.sentiment,
          embedding: i.embedding,
        }));
        return [
          {
            label: 'all',
            keywords: ['x'],
            mentions: items.length,
            sentiment: 0,
            exampleReviewIds: items.map((i) => i.review.id),
          },
        ];
      },
    };

    const result = await runToResult(
      new Pipeline()
        .source(arrayAdapter(reviews()))
        .provider(embeddingProvider())
        .themes(extractor),
      null,
    );

    expect(result.themes).toHaveLength(1);
    expect(result.themes[0]?.mentions).toBe(3);
    expect(received.every((i) => typeof i.sentiment === 'number')).toBe(true);
    expect(received.every((i) => Array.isArray(i.embedding))).toBe(true);
  });

  it('records a per-review error when embedding fails, without aborting', async () => {
    const provider = embeddingProvider({
      embed: (review) => {
        if (review.id === 'b') throw new Error('embed boom');
        return [1, 2];
      },
    });
    const captured: (number[] | undefined)[] = [];
    const extractor = {
      extract: (items: { embedding?: number[] }[]) => {
        for (const item of items) captured.push(item.embedding);
        return [];
      },
    };

    const result = await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(provider).themes(extractor),
      null,
    );

    expect(result.errors).toContainEqual({
      stage: 'provider',
      reviewId: 'b',
      message: 'embedding failed: embed boom',
    });
    expect(captured.filter((e) => e === undefined)).toHaveLength(1);
  });

  it('records a non-fatal error when the extractor throws', async () => {
    const extractor = {
      extract: () => {
        throw new Error('cluster boom');
      },
    };

    const result = await runToResult(
      new Pipeline()
        .source(arrayAdapter(reviews()))
        .provider(ratingProvider())
        .themes(extractor),
      null,
    );

    expect(result.themes).toEqual([]);
    expect(result.errors[0]).toMatchObject({ stage: 'themes' });
    expect(result.errors[0]?.message).toContain('cluster boom');
  });

  it('does not embed when the provider lacks the embeddings capability', async () => {
    const embed = vi.fn(() => [1, 2]);
    const provider = ratingProvider({ embed });
    const extractor = { extract: () => [] };

    await runToResult(
      new Pipeline().source(arrayAdapter(reviews())).provider(provider).themes(extractor),
      null,
    );
    expect(embed).not.toHaveBeenCalled();
  });
});
