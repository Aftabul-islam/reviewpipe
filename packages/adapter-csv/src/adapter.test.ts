import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Pipeline, type AnalysisProvider, type SentimentResult } from '@reviewpipe/core';
import { CsvAdapter } from './adapter.js';

describe('CsvAdapter', () => {
  it('parses rows into NormalizedReviews with typed fields', () => {
    const csv = [
      'id,text,rating,date,author,productId,source',
      'r1,"Great product",5,2026-01-01,alice,SKU-1,shop',
      'r2,"Awful",1,2026-01-02,bob,SKU-2,shop',
    ].join('\n');

    const reviews = new CsvAdapter().parse(csv);

    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      id: 'r1',
      text: 'Great product',
      rating: 5,
      date: '2026-01-01',
      author: 'alice',
      productId: 'SKU-1',
      source: 'shop',
    });
    expect(reviews[0]?.raw).toEqual({
      id: 'r1',
      text: 'Great product',
      rating: '5',
      date: '2026-01-01',
      author: 'alice',
      productId: 'SKU-1',
      source: 'shop',
    });
  });

  it('throws a clear error naming the missing text column', () => {
    const csv = 'id,body,rating\nr1,hello,5';
    expect(() => new CsvAdapter().parse(csv)).toThrow(
      /missing required column\(s\): text/,
    );
  });

  it('supports remapping columns to the required field', () => {
    const csv = 'id,review_body,stars\nr1,Loved it,5';
    const [review] = new CsvAdapter({
      columns: { text: 'review_body', rating: 'stars' },
    }).parse(csv);
    expect(review).toMatchObject({ text: 'Loved it', rating: 5 });
  });

  it('keeps empty text rows and treats blank/NA ratings as undefined', () => {
    const csv = 'id,text,rating\nr1,,3\nr2,ok,\nr3,fine,N/A';
    const reviews = new CsvAdapter().parse(csv);
    expect(reviews[0]?.text).toBe('');
    expect(reviews[1]?.rating).toBeUndefined();
    expect(reviews[2]?.rating).toBeUndefined();
  });

  it('generates ids when absent and defaults the source', () => {
    const csv = 'text,rating\nfirst,4\nsecond,2';
    const reviews = new CsvAdapter({ source: 'import' }).parse(csv);
    expect(reviews.map((r) => r.id)).toEqual(['csv-0', 'csv-1']);
    expect(reviews.every((r) => r.source === 'import')).toBe(true);
  });

  it('ignores extra columns and skips blank lines', () => {
    const csv = 'text,rating,extra\n\nhello,5,ignored\n\n';
    const reviews = new CsvAdapter().parse(csv);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.text).toBe('hello');
    expect((reviews[0]?.raw as Record<string, string>).extra).toBe('ignored');
  });

  it('passes malformed dates through without throwing', () => {
    const csv = 'text,date\nhi,not-a-real-date';
    const [review] = new CsvAdapter().parse(csv);
    expect(review?.date).toBe('not-a-real-date');
  });
});

describe('CsvAdapter — committed fixture contract', () => {
  const fixture = readFileSync(
    fileURLToPath(new URL('../../../data/fixtures/reviews.csv', import.meta.url)),
    'utf8',
  );

  it('parses all 25 fixture rows and their edge cases', () => {
    const reviews = new CsvAdapter().parse(fixture);
    expect(reviews).toHaveLength(25);

    const byId = new Map(reviews.map((r) => [r.id, r]));
    expect(byId.get('f008')?.text).toBe('');
    expect(byId.get('f025')?.rating).toBeUndefined();
    expect(byId.get('f001')?.rating).toBe(5);
  });

  it('flows through the pipeline end to end', async () => {
    const provider: AnalysisProvider = {
      name: 'stub',
      capabilities: {
        sentiment: true,
        embeddings: false,
        summarization: false,
        customPrompts: false,
      },
      classifySentiment: (review): SentimentResult => ({
        score: (review.rating ?? 3) >= 4 ? 0.6 : -0.6,
        label: (review.rating ?? 3) >= 4 ? 'positive' : 'negative',
      }),
    };

    const out = await new Pipeline()
      .source(new CsvAdapter())
      .provider(provider)
      .run(fixture);
    if (typeof out === 'string' || out instanceof Uint8Array)
      throw new Error('unexpected output');
    expect(out.overallSentiment.reviewCount).toBe(25);
    expect(out.errors).toEqual([]);
  });
});
