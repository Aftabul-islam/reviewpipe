# @reviewpipe/exporter-html

Renders a reviewpipe `AnalysisResult` as a **single self-contained HTML file** —
inline CSS and inline SVG charts, no external requests, no `<script>` tags,
openable directly in a browser (works offline).

```ts
import { Pipeline } from '@reviewpipe/core';
import { HtmlExporter } from '@reviewpipe/exporter-html';

const html = await new Pipeline()
  .source(adapter)
  .provider(provider)
  .export(new HtmlExporter({ title: 'Q1 reviews' }))
  .run(input);

// html is a full document string — write it to a .html file and open it.
```

The dashboard shows:

- **Sentiment breakdown** — a stacked bar plus a legend with counts and percentages.
- **Summary** — the provider's narrative summary, when present.
- **Themes** — a table of label, mention count (with a bar), sentiment, and keywords.
- **Trend over time** — a zero-baseline bar chart of average sentiment per period.
- **Flagged reviews** — reason, score, and text for reviews needing attention.

All review-derived text is HTML-escaped. Options: `title` (defaults to
`'reviewpipe report'`). Styling adapts to the viewer's light/dark theme.
