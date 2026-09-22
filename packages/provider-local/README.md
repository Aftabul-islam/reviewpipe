# @reviewpipe/provider-local

On-device sentiment and embeddings for reviewpipe (**Tier 0**) via
[transformers.js](https://github.com/xenova/transformers.js). No API key, and no
network once the models are cached locally.

## Optional dependency

`@xenova/transformers` is an **optional peer dependency**. Installing this
package alone adds no ML weight — the library is loaded lazily (dynamic
`import()`) only when a model is first needed. To actually run models, install it
alongside:

```bash
pnpm add @reviewpipe/provider-local @xenova/transformers
```

If it isn't installed, the first `classifySentiment`/`embed` call throws a clear
error telling you to add it.

## Usage

```ts
import { Pipeline } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LocalProvider } from '@reviewpipe/provider-local';

const result = await new Pipeline()
  .source(new CsvAdapter())
  .provider(new LocalProvider())
  .run(csvText);
```

`capabilities`: `{ sentiment: true, embeddings: true, summarization: false, customPrompts: false }`.

- **Sentiment** uses a distilled SST-2 model, which is **binary** — results are
  `positive` or `negative` (never `neutral`), except empty input, which returns a
  no-signal neutral without loading a model. `score` is signed into `[-1, 1]`.
- **Embeddings** use all-MiniLM-L6-v2 (mean-pooled, normalized), for theme
  clustering.

Each model pipeline is created once and reused across calls. Override the model
ids or inject a custom pipeline factory via the constructor options.

## Tests

Unit tests mock the pipeline, so they neither download models nor require
`@xenova/transformers` — they run in normal CI.

The integration tests download and run the real models and are **excluded from
the default test run**. To run them:

```bash
pnpm add -Dw @xenova/transformers   # once, at the workspace root
pnpm test:integration
```
