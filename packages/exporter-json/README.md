# @reviewpipe/exporter-json

Serializes a reviewpipe `AnalysisResult` to JSON. This is the lossless,
full-fidelity export — every field of the result is preserved, so exporting and
re-parsing round-trips exactly.

```ts
import { Pipeline } from '@reviewpipe/core';
import { JsonExporter } from '@reviewpipe/exporter-json';

const json = await new Pipeline()
  .source(adapter)
  .provider(provider)
  .export(new JsonExporter()) // or new JsonExporter({ indent: 0 }) for compact
  .run(input);
```

Output is pretty-printed with two-space indentation by default; pass
`{ indent: 0 }` for compact single-line JSON. `undefined` fields (such as an
absent `summary`) are omitted, following standard JSON semantics.
