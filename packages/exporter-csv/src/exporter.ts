import type { AnalysisResult, Exporter, Theme, TrendPoint } from '@reviewpipe/core';
import { stringify } from 'csv-stringify/sync';

/** Delimiter used to pack list-valued cells (keywords, example ids) into one field. */
export const LIST_DELIMITER = ';';

const HEADER = [
  'section',
  'label',
  'keywords',
  'mentions',
  'sentiment',
  'exampleReviewIds',
  'period',
  'averageSentiment',
  'reviewCount',
] as const;

/**
 * Flattens an {@link AnalysisResult}'s `themes` and `trend` into a single tidy
 * CSV table. Each row is tagged by a `section` column (`theme` or `trend`), and
 * columns not relevant to a row are left blank. List-valued fields are joined
 * with `;`. Numbers are written unrounded so the table round-trips exactly.
 *
 * This is a lossy, tabular view — overall sentiment, flagged reviews, and the
 * summary are not included. Use `@reviewpipe/exporter-json` for the full result.
 * The schema is documented in this package's README.
 *
 * @example
 * ```ts
 * const csv = new CsvExporter().export(result);
 * ```
 */
export class CsvExporter implements Exporter {
  export(result: AnalysisResult): string {
    const rows = [...result.themes.map(themeRow), ...result.trend.map(trendRow)];
    return stringify([[...HEADER], ...rows]);
  }
}

function themeRow(theme: Theme): (string | number)[] {
  return [
    'theme',
    theme.label,
    theme.keywords.join(LIST_DELIMITER),
    theme.mentions,
    theme.sentiment,
    theme.exampleReviewIds.join(LIST_DELIMITER),
    '',
    '',
    '',
  ];
}

function trendRow(point: TrendPoint): (string | number)[] {
  return [
    'trend',
    '',
    '',
    '',
    '',
    '',
    point.period,
    point.averageSentiment,
    point.reviewCount,
  ];
}
