# Example: Express API

A minimal Express server with one `POST /analyze` route that accepts a CSV body
and returns the `AnalysisResult` as JSON, using the zero-dependency lexicon
provider.

From the repo root:

```bash
pnpm install
pnpm --filter express-api start   # listens on http://localhost:3000
```

Then, in another terminal, POST a CSV (any CSV with `id` and `text` columns):

```bash
curl --data-binary @examples/node-batch-script/reviews.csv \
  -H 'Content-Type: text/csv' \
  http://localhost:3000/analyze
```

No API key and no network are needed. Set `PORT` to change the port.
