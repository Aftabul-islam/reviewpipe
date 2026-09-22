import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse } from 'csv-parse/sync';
import {
  Pipeline,
  type AnalysisResult,
  type Theme,
  type TrendPoint,
} from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { CsvExporter, LIST_DELIMITER } from './exporter.js';

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
      {
        label: 'quality',
        keywords: ['quality'],
        mentions: 2,
        sentiment: 0.4,
        exampleReviewIds: [],
      },
    ],
    trend: [
      { period: '2026-01', averageSentiment: 0.2, reviewCount: 4 },
      { period: '2026-02', averageSentiment: -0.15, reviewCount: 6 },
    ],
    flagged: [],
    errors: [],
    ...overrides,
  };
}

function reparse(csv: string): { themes: Theme[]; trend: TrendPoint[] } {
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];
  const themes = rows
    .filter((row) => row.section === 'theme')
    .map((row) => ({
      label: row.label ?? '',
      keywords: row.keywords ? row.keywords.split(LIST_DELIMITER) : [],
      mentions: Number(row.mentions),
      sentiment: Number(row.sentiment),
      exampleReviewIds: row.exampleReviewIds
        ? row.exampleReviewIds.split(LIST_DELIMITER)
        : [],
    }));
  const trend = rows
    .filter((row) => row.section === 'trend')
    .map((row) => ({
      period: row.period ?? '',
      averageSentiment: Number(row.averageSentiment),
      reviewCount: Number(row.reviewCount),
    }));
  return { themes, trend };
}

describe('CsvExporter', () => {
  it('round-trips themes and trend through the documented schema', () => {
    const result = sampleResult();
    const { themes, trend } = reparse(new CsvExporter().export(result));
    expect(themes).toEqual(result.themes);
    expect(trend).toEqual(result.trend);
  });

  it('produces just the header row for an empty result', () => {
    const csv = new CsvExporter().export(sampleResult({ themes: [], trend: [] }));
    const lines = csv.trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('section');
  });

  it('escapes fields that contain commas', () => {
    const result = sampleResult({
      themes: [
        {
          label: 'fit, sizing',
          keywords: ['too small'],
          mentions: 1,
          sentiment: 0,
          exampleReviewIds: [],
        },
      ],
      trend: [],
    });
    const csv = new CsvExporter().export(result);
    expect(csv).toContain('"fit, sizing"');
    expect(reparse(csv).themes[0]?.label).toBe('fit, sizing');
  });
});

describe('milestone — CSV in, lexicon, CSV out', () => {
  it('runs the full pipeline and produces a parseable CSV', async () => {
    const fixture = readFileSync(
      fileURLToPath(new URL('../../../data/fixtures/reviews.csv', import.meta.url)),
      'utf8',
    );

    const out = await new Pipeline()
      .source(new CsvAdapter())
      .provider(new LexiconProvider())
      .export(new CsvExporter())
      .run(fixture);

    expect(typeof out).toBe('string');
    const { trend } = reparse(out as string);
    // The fixture spans January–February 2026, so we expect trend rows out.
    expect(trend.length).toBeGreaterThan(0);
    expect(trend.every((point) => Number.isFinite(point.reviewCount))).toBe(true);
  });
});
