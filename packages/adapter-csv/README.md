# @reviewpipe/adapter-csv

CSV source adapter for [reviewpipe](https://github.com/Aftabul-islam/reviewpipe)
— turns CSV text into `NormalizedReview[]`.

```bash
npm install @reviewpipe/adapter-csv
```

```ts
import { Pipeline } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';

const reviews = await new CsvAdapter().parse(csvText);

// or inside a pipeline:
await new Pipeline().source(new CsvAdapter()).provider(provider).run(csvText);
```

Parses CSV with a header row. The `text` column is **required** — a clear error
names any missing required column. Column names are remappable, missing ids are
generated, blank/`N/A` ratings become `undefined`, empty-text rows are kept,
extra columns are ignored but preserved on `raw`, and dates pass through
verbatim.

```ts
new CsvAdapter({
  columns: { text: 'review_body', rating: 'stars' }, // remap headers
  source: 'amazon-export', // default source value
});
```

## License

Apache-2.0
