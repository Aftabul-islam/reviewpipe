import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Pipeline, type AnalysisResult } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { HtmlExporter } from './exporter.js';

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
        exampleReviewIds: ['a'],
      },
      {
        label: 'quality',
        keywords: ['quality'],
        mentions: 1,
        sentiment: 0.4,
        exampleReviewIds: ['b'],
      },
    ],
    summary: 'Mostly positive with shipping complaints.',
    trend: [
      { period: '2026-01', averageSentiment: 0.2, reviewCount: 3 },
      { period: '2026-02', averageSentiment: -0.15, reviewCount: 1 },
    ],
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

describe('HtmlExporter', () => {
  it('produces a self-contained HTML document with no external resources', () => {
    const html = new HtmlExporter({ title: 'My Report' }).export(sampleResult());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>My Report</title>');
    expect(html).toContain('<svg');
    // Self-contained: no scripts, no network requests.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html.toLowerCase()).not.toContain('cdn');
  });

  it('renders sentiment counts, themes, trend, summary, and flagged reviews', () => {
    const html = new HtmlExporter().export(sampleResult());
    expect(html).toContain('reviewpipe report');
    expect(html).toContain('shipping');
    expect(html).toContain('quality');
    expect(html).toContain('2026-01');
    expect(html).toContain('Mostly positive with shipping complaints.');
    expect(html).toContain('rating/text mismatch');
  });

  it('escapes HTML in review-derived text to prevent injection', () => {
    const html = new HtmlExporter().export(
      sampleResult({
        themes: [
          {
            label: '<script>alert(1)</script>',
            keywords: [],
            mentions: 1,
            sentiment: 0,
            exampleReviewIds: [],
          },
        ],
        flagged: [
          {
            reviewId: 'x',
            text: '<img src=x onerror=alert(1)>',
            score: -0.9,
            reason: 'strongly negative',
          },
        ],
        summary: '<b>bold</b>',
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('shows placeholders for empty themes, trend, and flagged sections', () => {
    const html = new HtmlExporter().export(
      sampleResult({ themes: [], trend: [], flagged: [], summary: undefined }),
    );
    expect(html).toContain('No themes were extracted.');
    expect(html).toContain('No dated reviews to plot.');
    expect(html).toContain('None flagged.');
  });
});

describe('HtmlExporter — end to end', () => {
  it('renders the fixture through CSV → lexicon → HTML', async () => {
    const fixture = readFileSync(
      fileURLToPath(new URL('../../../data/fixtures/reviews.csv', import.meta.url)),
      'utf8',
    );

    const out = await new Pipeline()
      .source(new CsvAdapter())
      .provider(new LexiconProvider())
      .export(new HtmlExporter())
      .run(fixture);

    expect(typeof out).toBe('string');
    const html = out as string;
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('25 reviews analyzed');
  });
});
