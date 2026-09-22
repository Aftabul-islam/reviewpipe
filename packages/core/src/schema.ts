/**
 * A single customer review, normalized into the shape every part of the
 * pipeline agrees on. Adapters produce these from raw input; transformers,
 * providers, and aggregation all consume them.
 *
 * Only {@link NormalizedReview.id}, {@link NormalizedReview.text}, and
 * {@link NormalizedReview.source} are guaranteed present — real-world exports
 * routinely omit everything else, so the rest is optional by design.
 */
export interface NormalizedReview {
  /** Stable identifier, unique within a single pipeline run. */
  id: string;

  /**
   * The review body. May be empty string for reviews that carry only a
   * rating — providers decide how to treat empty text (the lexicon provider,
   * for example, scores it as neutral with low confidence).
   */
  text: string;

  /**
   * Star rating on the source's original scale (typically 1–5, higher is
   * better). Absent when the source record has no rating.
   */
  rating?: number;

  /**
   * Review timestamp as an ISO 8601 string (date or full datetime, e.g.
   * `'2026-01-05'`). Absent when the source provides no date; trend analysis
   * skips reviews without one.
   */
  date?: string;

  /** Display name or handle of the reviewer, when the source exposes it. */
  author?: string;

  /** Identifier of the product the review is about, when known. */
  productId?: string;

  /**
   * Where the review came from, set by the adapter (e.g. `'amazon-csv'`,
   * `'yelp'`). Used to attribute results back to their origin.
   */
  source: string;

  /**
   * The original, unmodified source record. Preserved so adapters can round-
   * trip source-specific fields and so failures can be traced back to input.
   * Core never reads this — treat it as opaque.
   */
  raw?: unknown;
}
