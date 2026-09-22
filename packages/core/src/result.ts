/**
 * Schema version stamped onto every {@link AnalysisResult}. Bumped when the
 * result shape changes in a way consumers (exporters, stored results) need to
 * detect. Follows semver: major changes are breaking.
 */
export const SCHEMA_VERSION = '1.0.0';

/** Sentiment polarity bucket a review falls into. */
export type SentimentLabel = 'positive' | 'neutral' | 'negative';

/**
 * Aggregate sentiment across every successfully analyzed review in a run.
 * Reviews that failed analysis are excluded here and recorded in
 * {@link AnalysisResult.errors} instead.
 */
export interface OverallSentiment {
  /** Mean sentiment score in `[-1, 1]`; `0` when there are no scored reviews. */
  score: number;
  /** Number of reviews scored positive. */
  positive: number;
  /** Number of reviews scored neutral. */
  neutral: number;
  /** Number of reviews scored negative. */
  negative: number;
  /** Total reviews contributing to this aggregate. */
  reviewCount: number;
}

/**
 * A recurring topic surfaced across the reviews, either by keyword frequency
 * or by embedding-based clustering, depending on provider capabilities.
 */
export interface Theme {
  /** Human-readable label, e.g. `'shipping'` or `'fit & sizing'`. */
  label: string;
  /** Distinctive terms that define the theme, most representative first. */
  keywords: string[];
  /** How many reviews were assigned to this theme. */
  mentions: number;
  /** Mean sentiment in `[-1, 1]` of the reviews in this theme. */
  sentiment: number;
  /** IDs of a few representative reviews, for drill-down and display. */
  exampleReviewIds: string[];
}

/**
 * Average sentiment over one time bucket, for plotting change over time. The
 * granularity of {@link TrendPoint.period} (day, month, …) is decided by
 * aggregation, not fixed here.
 */
export interface TrendPoint {
  /** The bucket label, e.g. `'2026-01'` for a month or `'2026-01-05'` for a day. */
  period: string;
  /** Mean sentiment in `[-1, 1]` of reviews dated within this bucket. */
  averageSentiment: number;
  /** Number of reviews in this bucket. */
  reviewCount: number;
}

/**
 * A review singled out for human attention — e.g. strongly negative, or a
 * rating/text mismatch (5 stars with scathing text). The specific reason is
 * decided by aggregation and carried in {@link FlaggedReview.reason}.
 */
export interface FlaggedReview {
  /** The {@link NormalizedReview.id} of the flagged review. */
  reviewId: string;
  /** The review text, duplicated here so exporters can display it directly. */
  text: string;
  /** The sentiment score in `[-1, 1]` that triggered or accompanies the flag. */
  score: number;
  /** Why it was flagged, e.g. `'rating/text mismatch'` or `'strongly negative'`. */
  reason: string;
}

/** The pipeline stage an error occurred in. */
export type PipelineStage = 'adapter' | 'transform' | 'provider' | 'export';

/**
 * A non-fatal failure recorded during a run. Per-review provider failures
 * carry a {@link PipelineError.reviewId}; stage-level failures (a whole
 * adapter or exporter throwing) do not. Collecting these instead of throwing
 * is how one bad review avoids crashing an entire batch.
 */
export interface PipelineError {
  /** Where the failure happened. */
  stage: PipelineStage;
  /** Human-readable description of what went wrong. */
  message: string;
  /** The offending review's id, when the failure was scoped to one review. */
  reviewId?: string;
}

/**
 * The structured output of a pipeline run: aggregate sentiment, themes,
 * an optional narrative summary, a time trend, flagged reviews, and any
 * per-item errors. Exporters turn this into JSON, CSV, HTML, and so on.
 */
export interface AnalysisResult {
  /** The {@link SCHEMA_VERSION} this result was produced under. */
  schemaVersion: string;
  /** Aggregate sentiment across the run. */
  overallSentiment: OverallSentiment;
  /** Recurring themes, typically ordered by mention count. */
  themes: Theme[];
  /** Narrative summary, present only when the provider supports summarization. */
  summary?: string;
  /** Sentiment over time, empty when no reviews carried usable dates. */
  trend: TrendPoint[];
  /** Reviews flagged for attention. */
  flagged: FlaggedReview[];
  /** Non-fatal errors gathered during the run; empty on a fully clean run. */
  errors: PipelineError[];
}
