import type { NormalizedReview } from './schema.js';
import type { AnalysisResult, SentimentLabel, Theme } from './result.js';

/** A value that may be returned synchronously or as a promise. */
export type Awaitable<T> = T | Promise<T>;

/**
 * Turns raw input of a specific format into normalized reviews. Each input
 * format (CSV, JSON, a platform export) has its own adapter.
 *
 * Adapters own input validation: given unusable input (e.g. a CSV with no
 * `text` column), throw an error that names what was missing rather than
 * silently producing empty or malformed reviews.
 */
export interface SourceAdapter {
  /**
   * Parse raw input into normalized reviews. `input` is whatever the caller
   * passed to the pipeline (a file path, a string, a parsed object) — the
   * adapter decides what it accepts.
   */
  parse(input: unknown): Awaitable<NormalizedReview[]>;
}

/**
 * A single step that rewrites the review set before analysis — cleaning text,
 * filtering, deduping, language-tagging. Transformers run in the order they
 * were added to the pipeline, each receiving the previous step's output.
 */
export interface Transformer {
  /**
   * Return the transformed reviews. May add, drop, or modify reviews, but
   * should not mutate the input array in place.
   */
  transform(reviews: NormalizedReview[]): Awaitable<NormalizedReview[]>;
}

/**
 * Declares which analysis operations a provider supports, so the pipeline can
 * degrade gracefully: it checks the relevant flag before calling the matching
 * method, and skips the corresponding output rather than failing when a
 * capability is absent.
 */
export interface ProviderCapabilities {
  /** Whether {@link AnalysisProvider.classifySentiment} is implemented. */
  sentiment: boolean;
  /** Whether {@link AnalysisProvider.embed} is implemented (enables clustering). */
  embeddings: boolean;
  /** Whether {@link AnalysisProvider.summarize} is implemented. */
  summarization: boolean;
  /** Whether the provider accepts a user-supplied prompt override. */
  customPrompts: boolean;
}

/** Sentiment scored for a single review. */
export interface SentimentResult {
  /** Polarity in `[-1, 1]`: `-1` most negative, `1` most positive. */
  score: number;
  /** The bucket {@link SentimentResult.score} falls into. */
  label: SentimentLabel;
  /**
   * Confidence in `[0, 1]`, when the provider can express it. Providers flag
   * empty or ambiguous input with a low value rather than throwing.
   */
  confidence?: number;
}

/**
 * Turns normalized reviews into sentiment, embeddings, and/or summaries.
 * Every model tier — lexicon, local, hosted, frontier — implements this one
 * interface; {@link AnalysisProvider.capabilities} is what tells the pipeline
 * which of the optional methods are actually available.
 *
 * The optional methods are present exactly when their capability flag is true.
 * `classifySentiment` should fail per review, not per batch: throwing for one
 * review lets the pipeline record the error and continue with the rest.
 */
export interface AnalysisProvider {
  /** Short identifier for the provider, used in errors and result attribution. */
  readonly name: string;

  /** What this provider can do; gates which optional methods below exist. */
  readonly capabilities: ProviderCapabilities;

  /**
   * Score one review's sentiment. Present when `capabilities.sentiment` is
   * true. May throw for a single unprocessable review.
   */
  classifySentiment?(review: NormalizedReview): Awaitable<SentimentResult>;

  /**
   * Produce an embedding vector for one review, used by theme clustering.
   * Present when `capabilities.embeddings` is true. All vectors from a given
   * provider share the same length.
   */
  embed?(review: NormalizedReview): Awaitable<number[]>;

  /**
   * Produce a narrative summary of the whole review set. Present when
   * `capabilities.summarization` is true.
   */
  summarize?(reviews: NormalizedReview[]): Awaitable<string>;
}

/** Serialized exporter output: text (JSON, CSV, HTML) or binary. */
export type ExporterOutput = string | Uint8Array;

/**
 * Turns an {@link AnalysisResult} into a serialized artifact — JSON, CSV, an
 * HTML dashboard. Binary formats return a `Uint8Array`; text formats return a
 * string.
 */
export interface Exporter {
  /** Serialize the result for output. */
  export(result: AnalysisResult): Awaitable<ExporterOutput>;
}

/**
 * One review handed to a {@link ThemeExtractor}, carrying whatever signals the
 * pipeline gathered: its sentiment score (when classified) and its embedding
 * vector (only when the provider supports `embed`). An extractor that needs
 * embeddings but finds them absent should fall back to text-only clustering.
 */
export interface ThemeItem {
  review: NormalizedReview;
  /** Sentiment score in `[-1, 1]`, present when the review was classified. */
  sentiment?: number;
  /** Embedding vector, present only when the provider produced one. */
  embedding?: number[];
}

/**
 * Groups reviews into recurring {@link Theme}s. Kept out of the core so the
 * clustering implementation (and its dependencies) stays optional — the
 * pipeline runs one only when {@link Pipeline.themes} is given it.
 */
export interface ThemeExtractor {
  /** Produce themes from the gathered per-review signals. */
  extract(items: ThemeItem[]): Awaitable<Theme[]>;
}
