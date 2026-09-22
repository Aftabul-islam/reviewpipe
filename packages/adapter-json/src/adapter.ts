import type { NormalizedReview, SourceAdapter } from '@reviewpipe/core';

/**
 * Maps {@link NormalizedReview} fields to dot-paths within each JSON record,
 * e.g. `{ text: 'review_body', rating: 'stars', productId: 'product.id' }`.
 * Only `text` is required; a numeric path segment indexes into an array.
 */
export interface FieldMap {
  id?: string;
  text: string;
  rating?: string;
  date?: string;
  author?: string;
  productId?: string;
  source?: string;
}

export interface FieldMapAdapterOptions {
  /** Dot-path to the records array when it is nested inside the input object. */
  recordsPath?: string;
  /** `source` value for records whose mapped source path is absent. Defaults to `'json'`. */
  source?: string;
}

/**
 * Turns arbitrary JSON into {@link NormalizedReview}s using a field-to-path map.
 * Accepts either a parsed value or a JSON string. Records missing an optional
 * field get `undefined`; a record missing its `text` value becomes empty text
 * rather than being dropped. Throws only when the records themselves can't be
 * located as an array.
 *
 * @example
 * ```ts
 * const reviews = await new FieldMapAdapter(
 *   { text: 'review_body', rating: 'stars' },
 *   { recordsPath: 'data.reviews' },
 * ).parse(json);
 * ```
 */
export class FieldMapAdapter implements SourceAdapter {
  constructor(
    private readonly fieldMap: FieldMap,
    private readonly options: FieldMapAdapterOptions = {},
  ) {}

  parse(input: unknown): NormalizedReview[] {
    const data: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    return this.resolveRecords(data).map((record, index) => this.toReview(record, index));
  }

  private resolveRecords(data: unknown): unknown[] {
    const { recordsPath } = this.options;
    const source = recordsPath ? getPath(data, recordsPath) : data;
    if (!Array.isArray(source)) {
      const where = recordsPath ? `at path "${recordsPath}"` : 'the input';
      throw new Error(`FieldMapAdapter: expected an array of records in ${where}`);
    }
    return source;
  }

  private toReview(record: unknown, index: number): NormalizedReview {
    const id = this.read('id', record);
    const source = stringOrUndefined(this.read('source', record));
    return {
      id: id !== undefined && String(id) !== '' ? String(id) : `json-${index}`,
      text: textValue(this.read('text', record)),
      rating: numberValue(this.read('rating', record)),
      date: stringOrUndefined(this.read('date', record)),
      author: stringOrUndefined(this.read('author', record)),
      productId: stringOrUndefined(this.read('productId', record)),
      source: source ?? this.options.source ?? 'json',
      raw: record,
    };
  }

  private read(field: keyof FieldMap, record: unknown): unknown {
    const path = this.fieldMap[field];
    return path === undefined ? undefined : getPath(record, path);
  }
}

function getPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value);
  return text === '' ? undefined : text;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
