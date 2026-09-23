# @reviewpipe/benchmarks

Sentiment benchmark harness. Runs a provider's `classifySentiment` over a
labeled dataset and reports accuracy plus per-class precision/recall/F1 and
macro-F1 to a `BENCHMARKS.md` at the repo root. That output is a local,
gitignored artifact — regenerate it any time with `pnpm benchmark`.

```bash
pnpm benchmark
# defaults: lexicon provider over data/fixtures/labeled-sentiment.csv

pnpm benchmark --provider local                 # Tier 0 (needs @xenova/transformers)
pnpm benchmark --dataset data/raw/amazon.csv    # a larger local dataset
```

The default run uses the **committed labeled fixture** and the zero-dependency
lexicon provider, so the numbers are fully reproducible with no downloads and no
network. Larger, more representative numbers come from pointing `--dataset` at a
file under `data/raw/` (see `pnpm data:download`); those are for local runs, not
CI. The dataset is a CSV with `id`, `text`, and `label` columns, where `label`
is `positive`, `neutral`, or `negative`.
