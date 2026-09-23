import { parse } from 'csv-parse/sync';
import type { SentimentLabel } from '@reviewpipe/core';

export interface LabeledReview {
  id: string;
  text: string;
  label: SentimentLabel;
}

/**
 * Parse a labeled-sentiment CSV (columns `id`, `text`, `label`) into rows. Rows
 * whose `label` is not one of the three sentiment labels are skipped, so a
 * malformed line never derails a benchmark run.
 */
export function parseLabeledCsv(csv: string): LabeledReview[] {
  const rows = parse(csv, {
    bom: true,
    trim: true,
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const labeled: LabeledReview[] = [];
  rows.forEach((row, index) => {
    const label = row.label;
    if (label === 'positive' || label === 'neutral' || label === 'negative') {
      labeled.push({ id: row.id || `row-${index}`, text: row.text ?? '', label });
    }
  });
  return labeled;
}
