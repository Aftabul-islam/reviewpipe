# @reviewpipe/adapter-json

JSON source adapter for [reviewpipe](https://github.com/Aftabul-islam/reviewpipe)
— maps arbitrary JSON records to `NormalizedReview[]` via a field-to-path map.

```bash
npm install @reviewpipe/adapter-json
```

```ts
import { FieldMapAdapter } from '@reviewpipe/adapter-json';

const adapter = new FieldMapAdapter(
  { text: 'review_body', rating: 'stars', productId: 'product.id' },
  { recordsPath: 'data.reviews' },
);

const reviews = await adapter.parse(json); // parsed value or a JSON string
```

Maps each `NormalizedReview` field to a dot-path within a record (a numeric
segment indexes an array). Accepts a parsed object/array or a JSON string, and
an optional `recordsPath` when the array is nested. A record missing its `text`
value becomes empty text rather than being dropped; it throws only when the
records can't be located as an array.

## License

Apache-2.0
