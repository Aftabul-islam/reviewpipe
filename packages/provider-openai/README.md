# @reviewpipe/provider-openai

Frontier provider (**Tier 2**) for reviewpipe backed by OpenAI models via the
official SDK.

```bash
pnpm add @reviewpipe/provider-openai openai
```

```ts
import { Pipeline } from '@reviewpipe/core';
import { OpenAIProvider } from '@reviewpipe/provider-openai';

const result = await new Pipeline()
  .source(adapter)
  .provider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }))
  .run(input);
```

`capabilities`: `{ sentiment: true, embeddings: true, summarization: true, customPrompts: true }`.

- `apiKey` is **required** (unless you inject custom `chat`/`embed`).
- **Custom prompts:** the summarization prompt is exported as `SUMMARY_PROMPT`;
  override it with the `promptOverride` option. The sentiment prompt is
  `SENTIMENT_PROMPT`.
- `openai` is an **optional** dependency loaded lazily on first use; a missing
  dep throws a clear error. Chat model defaults to `gpt-4o-mini`, embeddings to
  `text-embedding-3-small`.
- Empty text is scored as a no-signal neutral without an API call.
