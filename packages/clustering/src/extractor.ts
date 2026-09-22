import type { Theme, ThemeExtractor, ThemeItem } from '@reviewpipe/core';
import { groupByEmbeddings } from './cluster.js';
import { groupByKeywords, labelClusters } from './keywords.js';

export interface ClusteringOptions {
  /** Number of clusters. Defaults to a `sqrt(n/2)` heuristic, capped by `maxClusters`. */
  k?: number;
  /** Upper bound for the default `k` heuristic. Defaults to 8. */
  maxClusters?: number;
  /** Keywords to attach to each theme's label list. Defaults to 5. */
  keywordsPerTheme?: number;
  /** Example review ids to keep per theme. Defaults to 3. */
  exampleCount?: number;
  /** Seed for deterministic k-means initialization. Defaults to 42. */
  seed?: number;
}

const DEFAULT_MAX_CLUSTERS = 8;
const DEFAULT_KEYWORDS_PER_THEME = 5;
const DEFAULT_EXAMPLE_COUNT = 3;
const DEFAULT_SEED = 42;

/**
 * A {@link ThemeExtractor} that groups reviews into labeled themes. When every
 * item carries an embedding it clusters with k-means; otherwise it falls back
 * to keyword-frequency grouping — so it works with any provider, degrading
 * gracefully when embeddings aren't available. Each theme is labeled by its
 * most distinctive keywords, and carries the mean sentiment of its reviews.
 *
 * @example
 * ```ts
 * const result = await new Pipeline()
 *   .source(adapter)
 *   .provider(new LocalProvider())
 *   .themes(new ClusteringThemeExtractor())
 *   .run(input);
 * ```
 */
export class ClusteringThemeExtractor implements ThemeExtractor {
  constructor(private readonly options: ClusteringOptions = {}) {}

  extract(items: ThemeItem[]): Theme[] {
    if (items.length === 0) return [];

    const k = this.resolveClusterCount(items.length);
    const hasEmbeddings = items.every((item) => (item.embedding?.length ?? 0) > 0);
    const groups = hasEmbeddings
      ? groupByEmbeddings(items, k, this.options.seed ?? DEFAULT_SEED)
      : groupByKeywords(items, k);
    if (groups.length === 0) return [];

    const labels = labelClusters(
      groups.map((group) => group.map((item) => item.review.text)),
      this.options.keywordsPerTheme ?? DEFAULT_KEYWORDS_PER_THEME,
    );

    return groups
      .map((group, index) => this.buildTheme(group, labels[index] ?? [], index))
      .sort((a, b) => b.mentions - a.mentions || a.label.localeCompare(b.label));
  }

  private resolveClusterCount(n: number): number {
    if (this.options.k !== undefined) return clamp(this.options.k, 1, n);
    const max = this.options.maxClusters ?? DEFAULT_MAX_CLUSTERS;
    return clamp(Math.round(Math.sqrt(n / 2)), 1, Math.min(max, n));
  }

  private buildTheme(group: ThemeItem[], keywords: string[], index: number): Theme {
    const scores = group
      .map((item) => item.sentiment)
      .filter((score): score is number => score !== undefined);
    const sentiment = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
    const exampleCount = this.options.exampleCount ?? DEFAULT_EXAMPLE_COUNT;

    return {
      label: keywords[0] ?? `theme ${index + 1}`,
      keywords,
      mentions: group.length,
      sentiment,
      exampleReviewIds: group.slice(0, exampleCount).map((item) => item.review.id),
    };
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
