# @reviewpipe/exporter-csv

Flattens a reviewpipe `AnalysisResult`'s **themes** and **trend** into a single
tidy CSV table. This is a lossy, spreadsheet-friendly view — for the complete,
lossless result use [`@reviewpipe/exporter-json`](../exporter-json).

```ts
import { Pipeline } from '@reviewpipe/core';
import { CsvExporter } from '@reviewpipe/exporter-csv';

const csv = await new Pipeline()
  .source(adapter)
  .provider(provider)
  .export(new CsvExporter())
  .run(input);
```

## Schema

One CSV table with a header row. Every row carries a `section` column that says
what kind of record it is; columns that don't apply to a row are left blank.

| Column             | `theme` rows                           | `trend` rows                             |
| ------------------ | -------------------------------------- | ---------------------------------------- |
| `section`          | `"theme"`                              | `"trend"`                                |
| `label`            | theme label                            | —                                        |
| `keywords`         | keywords joined by `;`                 | —                                        |
| `mentions`         | number of reviews in the theme         | —                                        |
| `sentiment`        | mean sentiment of the theme, `[-1, 1]` | —                                        |
| `exampleReviewIds` | example review ids joined by `;`       | —                                        |
| `period`           | —                                      | time bucket, e.g. `"2026-01"`            |
| `averageSentiment` | —                                      | mean sentiment for the bucket, `[-1, 1]` |
| `reviewCount`      | —                                      | number of reviews in the bucket          |

Example:

```csv
section,label,keywords,mentions,sentiment,exampleReviewIds,period,averageSentiment,reviewCount
theme,shipping,shipping;delivery,3,-0.1,a;b,,,
trend,,,,,,2026-01,0.2,4
```

Notes:

- List-valued fields (`keywords`, `exampleReviewIds`) use `;` as the delimiter,
  exported as `LIST_DELIMITER`.
- Numbers are written unrounded, so the table round-trips exactly.
- An empty result (no themes, no trend) produces just the header row.
