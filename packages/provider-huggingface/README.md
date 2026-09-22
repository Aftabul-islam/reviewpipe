# @reviewpipe/provider-huggingface

Sentiment, embeddings, and summarization via the
[Hugging Face Inference API](https://huggingface.co/docs/api-inference) (**Tier
1** — hosted, bring your own token). A thin `fetch` wrapper — no SDK dependency.

```ts
import { Pipeline } from '@reviewpipe/core';
import { HuggingFaceProvider } from '@reviewpipe/provider-huggingface';

const result = await new Pipeline()
  .source(adapter)
  .provider(new HuggingFaceProvider({ apiKey: process.env.HF_TOKEN! }))
  .run(input);
```

`capabilities`: `{ sentiment: true, embeddings: true, summarization: true, customPrompts: false }`.

- `apiKey` is **required** — the constructor throws without one.
- Retries `429` (rate limit) and `503` (model loading) with exponential backoff
  (`maxRetries`, `initialBackoffMs`), and can pace requests with `batchSize` /
  `batchDelayMs`.
- Empty text is scored as a no-signal neutral without a network call.
- Models are configurable (`sentimentModel`, `embeddingModel`,
  `summarizationModel`); `fetch` and `sleep` are injectable for testing.
