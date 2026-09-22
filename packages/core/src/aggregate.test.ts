import { describe, it, expect } from 'vitest';
import { aggregate, type ClassifiedReview } from './aggregate.js';
import type { NormalizedReview } from './schema.js';
import type { SentimentResult } from './interfaces.js';

function classified(
  partial: Partial<NormalizedReview> & { id: string },
  sentiment: SentimentResult,
): ClassifiedReview {
  return { review: { text: '', source: 'test', ...partial }, sentiment };
}

const positive: SentimentResult = { score: 0.8, label: 'positive' };
const negative: SentimentResult = { score: -0.8, label: 'negative' };
const neutral: SentimentResult = { score: 0, label: 'neutral' };

describe('aggregate — overall sentiment', () => {
  it('counts labels and averages scores', () => {
    const { overallSentiment } = aggregate([
      classified({ id: 'a' }, positive),
      classified({ id: 'b' }, positive),
      classified({ id: 'c' }, negative),
      classified({ id: 'd' }, neutral),
    ]);

    expect(overallSentiment).toEqual({
      score: (0.8 + 0.8 - 0.8 + 0) / 4,
      positive: 2,
      neutral: 1,
      negative: 1,
      reviewCount: 4,
    });
  });

  it('returns a zeroed aggregate for empty input rather than throwing', () => {
    const result = aggregate([]);
    expect(result.overallSentiment).toEqual({
      score: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      reviewCount: 0,
    });
    expect(result.themes).toEqual([]);
    expect(result.trend).toEqual([]);
    expect(result.flagged).toEqual([]);
  });
});

describe('aggregate — trend', () => {
  it('buckets by month, sorts chronologically, and skips undated reviews', () => {
    const { trend } = aggregate([
      classified({ id: 'a', date: '2026-02-10' }, positive),
      classified({ id: 'b', date: '2026-01-05' }, positive),
      classified({ id: 'c', date: '2026-01-20' }, negative),
      classified({ id: 'd' }, positive),
    ]);

    expect(trend).toEqual([
      { period: '2026-01', averageSentiment: (0.8 - 0.8) / 2, reviewCount: 2 },
      { period: '2026-02', averageSentiment: 0.8, reviewCount: 1 },
    ]);
  });

  it('parses full ISO datetimes and drops unparseable dates', () => {
    const { trend } = aggregate([
      classified({ id: 'a', date: '2026-03-01T12:30:00Z' }, positive),
      classified({ id: 'b', date: 'not-a-date' }, negative),
    ]);

    expect(trend).toEqual([{ period: '2026-03', averageSentiment: 0.8, reviewCount: 1 }]);
  });
});

describe('aggregate — flagged', () => {
  it('flags a high rating with negative text as a mismatch', () => {
    const { flagged } = aggregate([classified({ id: 'a', rating: 5 }, negative)]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({
      reviewId: 'a',
      reason: expect.stringContaining('mismatch'),
    });
  });

  it('flags a low rating with positive text as a mismatch', () => {
    const { flagged } = aggregate([classified({ id: 'a', rating: 1 }, positive)]);
    expect(flagged[0]?.reason).toContain('mismatch');
  });

  it('flags strongly negative reviews even when the rating agrees', () => {
    const { flagged } = aggregate([classified({ id: 'a', rating: 1 }, negative)]);
    expect(flagged[0]?.reason).toBe('strongly negative');
  });

  it('does not flag consistent, moderate reviews', () => {
    const { flagged } = aggregate([
      classified({ id: 'a', rating: 5 }, positive),
      classified({ id: 'b', rating: 3 }, neutral),
    ]);
    expect(flagged).toEqual([]);
  });
});
