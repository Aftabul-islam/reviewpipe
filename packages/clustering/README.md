# @reviewpipe/clustering

Theme clustering for [reviewpipe](https://github.com/Aftabul-islam/reviewpipe) —
groups reviews into labeled themes and fills `result.themes`.

```bash
npm install @reviewpipe/clustering
```

```ts
import { Pipeline } from '@reviewpipe/core';
import { ClusteringThemeExtractor } from '@reviewpipe/clustering';

const result = await new Pipeline()
  .source(adapter)
  .provider(provider)
  .themes(new ClusteringThemeExtractor({ k: 3 }))
  .run(input);

result.themes; // [{ label, keywords, mentions, sentiment, exampleReviewIds }]
```

Implements the core `ThemeExtractor` interface. When every review carries an
embedding (from a provider that supports `embed`) it clusters with k-means;
otherwise it falls back to keyword-frequency grouping — so it works with any
provider. Clusters are labeled by cluster-vs-corpus TF-IDF, and each theme
carries the mean sentiment of its reviews. `k` and the keyword/example counts are
configurable.

## License

Apache-2.0
