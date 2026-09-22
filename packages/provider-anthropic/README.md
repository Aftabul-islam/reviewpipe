# @reviewpipe/provider-anthropic

Frontier provider (**Tier 2**) for reviewpipe backed by Anthropic's Claude
models via the official SDK.

```bash
pnpm add @reviewpipe/provider-anthropic @anthropic-ai/sdk
```

```ts
import { Pipeline } from '@reviewpipe/core';
import { AnthropicProvider } from '@reviewpipe/provider-anthropic';

const result = await new Pipeline()
  .source(adapter)
  .provider(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }))
  .run(input);
```

`capabilities`: `{ sentiment: true, embeddings: false, summarization: true, customPrompts: true }`.

- **No embeddings** — Anthropic has no embeddings endpoint. For embedding-based
  theme clustering, use `@reviewpipe/provider-openai` or `@reviewpipe/provider-local`.
- `apiKey` is **required** (unless you inject a custom `complete`).
- **Custom prompts:** the summarization prompt is exported as `SUMMARY_PROMPT`;
  override it with the `promptOverride` option. The sentiment prompt is
  `SENTIMENT_PROMPT`.
- `@anthropic-ai/sdk` is an **optional** dependency loaded lazily on first use;
  a missing dep throws a clear error. Model defaults to `claude-opus-4-8`.
- Empty text is scored as a no-signal neutral without an API call.
