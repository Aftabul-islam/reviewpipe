import type { NormalizedReview } from './schema.js';
import type { SentimentResult } from './interfaces.js';
import type { OverallSentiment, TrendPoint, FlaggedReview } from './result.js';

/** A review paired with the sentiment a provider scored for it. */
export interface ClassifiedReview {
  review: NormalizedReview;
  sentiment: SentimentResult;
}

/**
 * The provider-agnostic portions of an {@link AnalysisResult} that can be
 * derived purely from classified reviews. Themes are produced separately by an
 * optional {@link ThemeExtractor}; the pipeline wraps this with schema version,
 * themes, summary, and errors to form the full result.
 */
export interface Aggregation {
  overallSentiment: OverallSentiment;
  trend: TrendPoint[];
  flagged: FlaggedReview[];
}

// A star rating and a sentiment score pointing this far in opposite directions
// is treated as a contradiction worth surfacing (e.g. 5 stars, scathing text).
const MISMATCH_SCORE_THRESHOLD = 0.25;
const POSITIVE_RATING_MIN = 4;
const NEGATIVE_RATING_MAX = 2;
// Reviews at or below this score are flagged even when the rating agrees.
const STRONG_NEGATIVE_SCORE = -0.6;

const MONTH_PATTERN = /^(\d{4}-\d{2})/;

/**
 * Aggregate classified reviews into the shape an exporter can render. This is
 * deliberately provider-agnostic — it reads only the {@link SentimentResult}
 * each review carries, never anything model-specific.
 *
 * Themes are not produced here; they come from an optional theme extractor.
 * Empty input yields a zeroed {@link OverallSentiment} and empty arrays rather
 * than throwing.
 */
export function aggregate(classified: ClassifiedReview[]): Aggregation {
  return {
    overallSentiment: summarizeOverall(classified),
    trend: buildTrend(classified),
    flagged: findFlagged(classified),
  };
}

function summarizeOverall(classified: ClassifiedReview[]): OverallSentiment {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let scoreSum = 0;

  for (const { sentiment } of classified) {
    scoreSum += sentiment.score;
    if (sentiment.label === 'positive') positive += 1;
    else if (sentiment.label === 'negative') negative += 1;
    else neutral += 1;
  }

  const reviewCount = classified.length;
  return {
    score: reviewCount === 0 ? 0 : scoreSum / reviewCount,
    positive,
    neutral,
    negative,
    reviewCount,
  };
}

function buildTrend(classified: ClassifiedReview[]): TrendPoint[] {
  const buckets = new Map<string, { scoreSum: number; count: number }>();

  for (const { review, sentiment } of classified) {
    if (!review.date) continue;
    const period = monthBucket(review.date);
    if (!period) continue;

    const bucket = buckets.get(period) ?? { scoreSum: 0, count: 0 };
    bucket.scoreSum += sentiment.score;
    bucket.count += 1;
    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { scoreSum, count }]) => ({
      period,
      averageSentiment: scoreSum / count,
      reviewCount: count,
    }));
}

function findFlagged(classified: ClassifiedReview[]): FlaggedReview[] {
  const flagged: FlaggedReview[] = [];
  for (const { review, sentiment } of classified) {
    const reason = flagReason(review, sentiment);
    if (reason) {
      flagged.push({
        reviewId: review.id,
        text: review.text,
        score: sentiment.score,
        reason,
      });
    }
  }
  return flagged;
}

function flagReason(review: NormalizedReview, sentiment: SentimentResult): string | null {
  const { rating } = review;
  if (rating !== undefined) {
    if (rating >= POSITIVE_RATING_MIN && sentiment.score <= -MISMATCH_SCORE_THRESHOLD) {
      return 'rating/text mismatch: high rating, negative text';
    }
    if (rating <= NEGATIVE_RATING_MAX && sentiment.score >= MISMATCH_SCORE_THRESHOLD) {
      return 'rating/text mismatch: low rating, positive text';
    }
  }
  if (sentiment.score <= STRONG_NEGATIVE_SCORE) return 'strongly negative';
  return null;
}

function monthBucket(date: string): string | null {
  const match = MONTH_PATTERN.exec(date);
  if (match && match[1]) return match[1];

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${parsed.getUTCFullYear()}-${month}`;
}
