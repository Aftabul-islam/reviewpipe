# @reviewpipe/core

The core of [reviewpipe](https://github.com/Aftabul-islam/reviewpipe) — the
`Pipeline` engine, the pluggable interfaces, the `NormalizedReview` /
`AnalysisResult` types, and the provider-agnostic aggregation logic.

**Zero runtime dependencies.** Model- and format-specific code lives in separate
packages (adapters, providers, exporters); this package never pulls in an ML
dependency.

```bash
npm install @reviewpipe/core
```

```ts
import { Pipeline } from '@reviewpipe/core';

const result = await new Pipeline()
  .source(adapter) // a SourceAdapter — e.g. @reviewpipe/adapter-csv
  .provider(provider) // an AnalysisProvider — e.g. @reviewpipe/provider-lexicon
  .run(input);

result.overallSentiment; // { score, positive, neutral, negative, reviewCount }
result.trend; // average sentiment per month
result.flagged; // reviews needing attention (rating/text mismatch, strongly negative)
result.errors; // non-fatal per-review failures — one bad row never crashes the batch
```

## What's here

- **`Pipeline`** — a builder wiring `source → use(transform)* → provider → themes → export → run`.
- **Interfaces** — `SourceAdapter`, `Transformer`, `AnalysisProvider` (with a
  `capabilities` flag), `ThemeExtractor`, and `Exporter`. Everything else in the
  ecosystem implements one of these.
- **Types** — `NormalizedReview`, `AnalysisResult`, `SentimentResult`, `Theme`,
  `TrendPoint`, `FlaggedReview`, `PipelineError`, and `SCHEMA_VERSION`.

Provider failures are isolated per review; adapter/transformer failures are fatal
(nothing left to analyze). See the [documentation](https://github.com/Aftabul-islam/reviewpipe)
for the full guide.

## License

Apache-2.0
