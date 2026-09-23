# Example: Node batch script

Reads `reviews.csv`, runs the full pipeline with the zero-dependency **lexicon**
provider, and writes `out/report.json` and `out/report.html`.

From the repo root:

```bash
pnpm install
pnpm --filter node-batch-script start
```

No API key and no network are needed. Open `examples/node-batch-script/out/report.html`
in a browser to see the dashboard.

To use the on-device model instead (Tier 0), install `@xenova/transformers` and
swap `LexiconProvider` for `LocalProvider` from `@reviewpipe/provider-local`
(see the comment in `src/index.ts`).
