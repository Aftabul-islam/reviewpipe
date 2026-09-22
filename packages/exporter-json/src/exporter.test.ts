import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Pipeline, type AnalysisResult } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { JsonExporter } from './exporter.js';

function sampleResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    schemaVersion: '1.0.0',
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
        mentions: 3,
        sentiment: -0.1,
        exampleReviewIds: ['a', 'b'],
      },
    ],
    trend: [{ period: '2026-01', averageSentiment: 0.2, reviewCount: 4 }],
    flagged: [
      {
        reviewId: 'c',
        text: 'five stars but broken',
        score: -0.8,
        reason: 'rating/text mismatch',
      },
    ],
    errors: [],
    ...overrides,
  };
}

describe('JsonExporter', () => {
  it('round-trips an AnalysisResult without a summary', () => {
    const result = sampleResult();
    const parsed = JSON.parse(new JsonExporter().export(result));
    expect(parsed).toEqual(result);
  });

  it('round-trips an AnalysisResult with a summary', () => {
    const result = sampleResult({ summary: 'Mostly positive with shipping complaints.' });
    const parsed = JSON.parse(new JsonExporter().export(result));
    expect(parsed).toEqual(result);
  });

  it('pretty-prints by default and emits compact JSON when indent is 0', () => {
    const result = sampleResult();
    expect(new JsonExporter().export(result)).toContain('\n');
    const compact = new JsonExporter({ indent: 0 }).export(result);
    expect(compact).not.toContain('\n');
    expect(JSON.parse(compact)).toEqual(result);
  });
});

describe('milestone — CSV in, lexicon, JSON out', () => {
  it('runs the full pipeline and produces parseable JSON', async () => {
    const fixture = readFileSync(
      fileURLToPath(new URL('../../../data/fixtures/reviews.csv', import.meta.url)),
      'utf8',
    );

    const out = await new Pipeline()
      .source(new CsvAdapter())
      .provider(new LexiconProvider())
      .export(new JsonExporter())
      .run(fixture);

    expect(typeof out).toBe('string');
    const parsed = JSON.parse(out as string) as AnalysisResult;
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.overallSentiment.reviewCount).toBe(25);
    expect(parsed.errors).toEqual([]);
  });
});
