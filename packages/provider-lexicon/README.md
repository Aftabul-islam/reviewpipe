# @reviewpipe/provider-lexicon

Zero-dependency lexicon sentiment provider for
[reviewpipe](https://github.com/Aftabul-islam/reviewpipe) — the **Tier -1**
baseline. Scores sentiment offline with a bundled AFINN-style word list; no API
key, no network, no ML dependency.

```bash
npm install @reviewpipe/provider-lexicon
```

```ts
import { Pipeline } from '@reviewpipe/core';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';

const result = await new Pipeline()
  .source(adapter)
  .provider(new LexiconProvider())
  .run(input);
```

`capabilities`: `{ sentiment: true, embeddings: false, summarization: false, customPrompts: false }`.

Scoring sums AFINN valences with a simple negation window and squashes to
`[-1, 1]`; empty or no-match text returns a no-signal neutral (score `0`,
confidence `0`) rather than throwing. Also exports `scoreSentiment(text)` and a
hand-written TF-IDF `extractKeywords(documents)` utility.

## License

Apache-2.0
