import { describe, it, expect } from 'vitest';
import { FieldMapAdapter } from './adapter.js';

describe('FieldMapAdapter', () => {
  it('maps fields from arbitrary keys in an array of records', () => {
    const input = [
      { review_body: 'Loved it', stars: 5, when: '2026-01-01', user: 'alice' },
      { review_body: 'Hated it', stars: 1, when: '2026-01-02', user: 'bob' },
    ];

    const reviews = new FieldMapAdapter({
      text: 'review_body',
      rating: 'stars',
      date: 'when',
      author: 'user',
    }).parse(input);

    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      text: 'Loved it',
      rating: 5,
      date: '2026-01-01',
      author: 'alice',
    });
  });

  it('parses a JSON string and reads a nested records path', () => {
    const json = JSON.stringify({ data: { reviews: [{ body: 'ok', score: '4' }] } });
    const [review] = new FieldMapAdapter(
      { text: 'body', rating: 'score' },
      { recordsPath: 'data.reviews' },
    ).parse(json);
    expect(review).toMatchObject({ text: 'ok', rating: 4 });
  });

  it('resolves dot-paths, including numeric array indices', () => {
    const input = [
      { product: { id: 'SKU-9' }, tags: ['fit', 'quality'], comment: 'nice' },
    ];
    const [review] = new FieldMapAdapter({
      text: 'comment',
      productId: 'product.id',
      author: 'tags.0',
    }).parse(input);
    expect(review).toMatchObject({ productId: 'SKU-9', author: 'fit' });
  });

  it('coerces missing optional fields to undefined and missing text to empty', () => {
    const [review] = new FieldMapAdapter({ text: 'body', rating: 'stars' }).parse([
      { note: 'x' },
    ]);
    expect(review?.text).toBe('');
    expect(review?.rating).toBeUndefined();
    expect(review?.author).toBeUndefined();
  });

  it('accepts numeric or string ratings and rejects non-numeric strings', () => {
    const reviews = new FieldMapAdapter({ text: 'body', rating: 'stars' }).parse([
      { body: 'a', stars: 5 },
      { body: 'b', stars: '3' },
      { body: 'c', stars: 'five' },
    ]);
    expect(reviews.map((r) => r.rating)).toEqual([5, 3, undefined]);
  });

  it('generates ids when unmapped and defaults the source', () => {
    const reviews = new FieldMapAdapter({ text: 'body' }, { source: 'api' }).parse([
      { body: 'a' },
      { body: 'b' },
    ]);
    expect(reviews.map((r) => r.id)).toEqual(['json-0', 'json-1']);
    expect(reviews.every((r) => r.source === 'api')).toBe(true);
  });

  it('passes malformed dates through untouched', () => {
    const [review] = new FieldMapAdapter({ text: 'body', date: 'when' }).parse([
      { body: 'x', when: 'yesterday' },
    ]);
    expect(review?.date).toBe('yesterday');
  });

  it('throws a clear error when records are not an array', () => {
    expect(() =>
      new FieldMapAdapter({ text: 'body' }).parse({ not: 'an array' }),
    ).toThrow(/expected an array of records in the input/);
    expect(() =>
      new FieldMapAdapter({ text: 'body' }, { recordsPath: 'items' }).parse({
        items: 42,
      }),
    ).toThrow(/at path "items"/);
  });
});
