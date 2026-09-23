# reviewpipe

A pipeline framework for analyzing e-commerce customer reviews — **sentiment,
recurring themes, and trends** — with pluggable input formats, pluggable models,
and pluggable output formats.

Point it at raw reviews, get structured insight out. The core has **zero ML
dependencies**; every model- or format-specific piece is its own installable
package, so you only pull in what you use.

```ts
import { Pipeline } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';

const result = await new Pipeline()
  .source(new CsvAdapter())
  .provider(new LexiconProvider()) // no API key, no network, no ML deps
  .run(csvText);

result.overallSentiment; // { score, positive, neutral, negative, reviewCount }
result.trend; // sentiment per month
result.flagged; // e.g. 5-star text that reads negative
```

## What it is for

- Turning a batch of reviews (CSV, JSON, platform exports) into a structured
  `AnalysisResult`: overall sentiment, sentiment trend over time, flagged
  reviews (rating/text mismatches, strongly negative), recurring themes, and an
  optional narrative summary.
- Doing it at the accuracy/cost/privacy tradeoff you choose — from an offline
  word-list to a frontier LLM — behind one interface.
- Running fully offline with no API keys (the lexicon and local tiers).

## What it is not for

- Real-time / streaming analysis of individual reviews as they arrive — it's
  batch-oriented.
- A hosted service, database, or dashboard app — it's a library that produces
  data and static artifacts.
- Guaranteed state-of-the-art accuracy out of the box — the lexicon tier is a
  fast baseline; accuracy scales with the tier you pick.

## Install

Requires Node 20+. Install the core plus whichever adapter, provider, and
exporter you need:

```bash
npm install @reviewpipe/core @reviewpipe/adapter-csv @reviewpipe/provider-lexicon
```

## Provider tiers

All providers implement the same `AnalysisProvider` interface, so switching
tiers is a one-line change. A `capabilities` flag lets the pipeline degrade
gracefully when a provider can't do something.

| Tier       | Package                            | Extra deps             | Network             | Sentiment | Embeddings | Summaries | Best for                        |
| ---------- | ---------------------------------- | ---------------------- | ------------------- | :-------: | :--------: | :-------: | ------------------------------- |
| -1 lexicon | `@reviewpipe/provider-lexicon`     | none                   | no                  |     ✓     |     —      |     —     | fast, offline, private baseline |
| 0 local    | `@reviewpipe/provider-local`       | `@xenova/transformers` | first download only |     ✓     |     ✓      |     —     | on-device ML, no API key        |
| 1 hosted   | `@reviewpipe/provider-huggingface` | none (`fetch`)         | yes                 |     ✓     |     ✓      |     ✓     | hosted models, HF token         |
| 2 frontier | `@reviewpipe/provider-openai`      | `openai`               | yes                 |     ✓     |     ✓      |     ✓     | best quality, BYO key           |
| 2 frontier | `@reviewpipe/provider-anthropic`   | `@anthropic-ai/sdk`    | yes                 |     ✓     |     —      |     ✓     | best quality, BYO key           |

Rough guidance: the lexicon tier is the fastest and most private (nothing leaves
your machine) but the least nuanced; local trades a one-time model download for
on-device ML; the hosted and frontier tiers add summaries and higher accuracy at
the cost of latency, an API key, and sending data to a third party. You can
benchmark tiers on your own labeled data — see [`packages/benchmarks`](packages/benchmarks).

## The pipeline

`Pipeline` wires four (and an optional fifth) pluggable stages:

```
source(adapter) → use(transformer)* → provider → [themes(extractor)] → [export(exporter)] → run(input)
```

| Interface          | Role                                          | Bundled implementations                       |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| `SourceAdapter`    | raw input → `NormalizedReview[]`              | `CsvAdapter`, `FieldMapAdapter` (JSON)        |
| `Transformer`      | rewrite the review set (clean, filter, dedup) | — (bring your own)                            |
| `AnalysisProvider` | reviews → sentiment / embeddings / summary    | the five providers above                      |
| `ThemeExtractor`   | group reviews into labeled themes             | `ClusteringThemeExtractor`                    |
| `Exporter`         | `AnalysisResult` → serialized output          | `JsonExporter`, `CsvExporter`, `HtmlExporter` |

Provider failures are isolated **per review** — one unparseable review is
recorded in `result.errors[]` and the run continues, so one bad row never
crashes the batch.

### Adapters, exporters, clustering

- **Adapters** — `@reviewpipe/adapter-csv` (`CsvAdapter`) and
  `@reviewpipe/adapter-json` (`FieldMapAdapter`, maps arbitrary JSON fields to
  the schema via dot-paths).
- **Exporters** — `@reviewpipe/exporter-json` (lossless),
  `@reviewpipe/exporter-csv` (flat themes + trend table), and
  `@reviewpipe/exporter-html` (a self-contained dashboard with inline SVG
  charts — no scripts, no CDN, opens offline).
- **Clustering** — `@reviewpipe/clustering` (`ClusteringThemeExtractor`) groups
  reviews into labeled themes using k-means over embeddings when the provider
  supplies them, or keyword frequency otherwise.

## Examples

Runnable reference integrations (offline, no API key):

- [`examples/node-batch-script`](examples/node-batch-script) — read a CSV, run
  the pipeline, write JSON + HTML to disk.
- [`examples/express-api`](examples/express-api) — a minimal Express
  `POST /analyze` route returning JSON.

## Out of scope for V1

- Non-English sentiment beyond what a given model supports (the lexicon is
  English-only).
- Built-in deduplication or PII redaction transformers (the `Transformer`
  interface is provided; implementations are not).
- Incremental/streaming analysis, persistence, and multi-run diffing.
- Native embeddings for the Anthropic tier (Anthropic has no embeddings
  endpoint — use the OpenAI or local tier for embedding-based clustering).

## Development

```bash
pnpm install
pnpm -w test        # all tests (fixtures only, no network)
pnpm -w typecheck
pnpm -w lint
pnpm benchmark      # sentiment metrics on a committed labeled fixture
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
