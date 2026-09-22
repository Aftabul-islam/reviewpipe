import type { NormalizedReview, SourceAdapter } from '@reviewpipe/core';
import { parse as parseCsv } from 'csv-parse/sync';

/** NormalizedReview fields that can be populated from a CSV column. */
type MappableField =
  'id' | 'text' | 'rating' | 'date' | 'author' | 'productId' | 'source';

/** Maps a {@link NormalizedReview} field to the CSV column header it reads from. */
export type CsvColumnMap = Partial<Record<MappableField, string>>;

export interface CsvAdapterOptions {
  /** Override which column header supplies each field. Unspecified fields use the field name. */
  columns?: CsvColumnMap;
  /** `source` value for rows without a source column. Defaults to `'csv'`. */
  source?: string;
  /** Field delimiter. Defaults to `,`. */
  delimiter?: string;
}

const DEFAULT_COLUMNS: Record<MappableField, string> = {
  id: 'id',
  text: 'text',
  rating: 'rating',
  date: 'date',
  author: 'author',
  productId: 'productId',
  source: 'source',
};

const REQUIRED_FIELDS: MappableField[] = ['text'];

/**
 * Parses CSV text (with a header row) into {@link NormalizedReview}s. The `text`
 * column is required; missing `id` is filled with a generated id, and unmapped
 * or empty optional columns become `undefined`. Extra columns are ignored but
 * preserved on {@link NormalizedReview.raw}. Dates are passed through verbatim —
 * downstream trend analysis skips any it can't parse.
 *
 * @example
 * ```ts
 * const reviews = await new CsvAdapter({ columns: { text: 'review_body' } })
 *   .parse(csvText);
 * ```
 */
export class CsvAdapter implements SourceAdapter {
  private readonly columns: Record<MappableField, string>;

  constructor(private readonly options: CsvAdapterOptions = {}) {
    this.columns = { ...DEFAULT_COLUMNS, ...options.columns };
  }

  parse(input: unknown): NormalizedReview[] {
    let headers: string[] = [];
    const rows = parseCsv(toText(input), {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: this.options.delimiter,
      columns: (header: string[]) => {
        headers = header;
        return header;
      },
    }) as Record<string, string>[];

    const missing = REQUIRED_FIELDS.map((field) => this.columns[field]).filter(
      (column) => !headers.includes(column),
    );
    if (missing.length > 0) {
      throw new Error(
        `CsvAdapter: missing required column(s): ${missing.join(', ')}. ` +
          `Found columns: ${headers.join(', ') || '(none)'}`,
      );
    }

    return rows.map((row, index) => this.toReview(row, index));
  }

  private toReview(row: Record<string, string>, index: number): NormalizedReview {
    const id = nonEmpty(row[this.columns.id]);
    const source = nonEmpty(row[this.columns.source]);
    return {
      id: id ?? `csv-${index}`,
      text: row[this.columns.text] ?? '',
      rating: parseNumber(row[this.columns.rating]),
      date: nonEmpty(row[this.columns.date]),
      author: nonEmpty(row[this.columns.author]),
      productId: nonEmpty(row[this.columns.productId]),
      source: source ?? this.options.source ?? 'csv',
      raw: row,
    };
  }
}

function toText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Uint8Array) return new TextDecoder().decode(input);
  throw new Error('CsvAdapter: expected CSV input as a string or Uint8Array');
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
