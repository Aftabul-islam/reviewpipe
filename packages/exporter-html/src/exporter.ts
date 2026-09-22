import type {
  AnalysisResult,
  Exporter,
  FlaggedReview,
  OverallSentiment,
  Theme,
  TrendPoint,
} from '@reviewpipe/core';
import { escapeHtml, formatScore, percent } from './html.js';
import { COLORS, sentimentBar, trendChart } from './charts.js';

export interface HtmlExporterOptions {
  /** Document title and page heading. Defaults to `'reviewpipe report'`. */
  title?: string;
}

const DEFAULT_TITLE = 'reviewpipe report';
const MAX_FLAGGED = 20;

/**
 * Renders an {@link AnalysisResult} as a single self-contained HTML document —
 * inline CSS and inline SVG charts, no external requests or scripts, openable
 * directly in a browser. Shows the sentiment breakdown, top themes, the trend
 * over time, an optional summary, and sample flagged reviews. All review-derived
 * text is HTML-escaped.
 *
 * @example
 * ```ts
 * const html = new HtmlExporter({ title: 'Q1 reviews' }).export(result);
 * ```
 */
export class HtmlExporter implements Exporter {
  constructor(private readonly options: HtmlExporterOptions = {}) {}

  export(result: AnalysisResult): string {
    const title = escapeHtml(this.options.title ?? DEFAULT_TITLE);
    const body = [
      renderHeader(title, result.overallSentiment),
      renderSentiment(result.overallSentiment),
      renderSummary(result.summary),
      renderThemes(result.themes),
      renderTrend(result.trend),
      renderFlagged(result.flagged),
      renderFooter(result),
    ].join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
  }
}

function renderHeader(title: string, overall: OverallSentiment): string {
  return `<header>
    <h1>${title}</h1>
    <p class="lede">${overall.reviewCount} reviews analyzed · overall sentiment
      <strong>${formatScore(overall.score)}</strong></p>
  </header>`;
}

function renderSentiment(overall: OverallSentiment): string {
  const legend = [
    { label: 'Positive', count: overall.positive, fill: COLORS.positive },
    { label: 'Neutral', count: overall.neutral, fill: COLORS.neutral },
    { label: 'Negative', count: overall.negative, fill: COLORS.negative },
  ]
    .map(
      (item) =>
        `<li><span class="swatch" style="background:${item.fill}"></span>${item.label}
          <strong>${item.count}</strong>
          <span class="muted">(${percent(item.count, overall.reviewCount)}%)</span></li>`,
    )
    .join('');

  return `<section>
    <h2>Sentiment breakdown</h2>
    ${sentimentBar(overall)}
    <ul class="legend">${legend}</ul>
  </section>`;
}

function renderSummary(summary: string | undefined): string {
  if (!summary) return '';
  return `<section>
    <h2>Summary</h2>
    <p class="summary">${escapeHtml(summary)}</p>
  </section>`;
}

function renderThemes(themes: Theme[]): string {
  if (themes.length === 0) {
    return `<section><h2>Themes</h2><p class="muted">No themes were extracted.</p></section>`;
  }

  const maxMentions = Math.max(...themes.map((theme) => theme.mentions));
  const rows = themes
    .map((theme) => {
      const barWidth =
        maxMentions === 0 ? 0 : Math.round((theme.mentions / maxMentions) * 100);
      const keywords = theme.keywords.map(escapeHtml).join(', ');
      return `<tr>
        <td>${escapeHtml(theme.label)}</td>
        <td class="mentions">
          <span class="mention-bar" style="width:${barWidth}%"></span>${theme.mentions}
        </td>
        <td>${formatScore(theme.sentiment)}</td>
        <td class="muted">${keywords}</td>
      </tr>`;
    })
    .join('');

  return `<section>
    <h2>Themes</h2>
    <table>
      <thead><tr><th>Theme</th><th>Mentions</th><th>Sentiment</th><th>Keywords</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderTrend(trend: TrendPoint[]): string {
  if (trend.length === 0) {
    return `<section><h2>Trend over time</h2><p class="muted">No dated reviews to plot.</p></section>`;
  }
  return `<section><h2>Trend over time</h2><div class="scroll">${trendChart(trend)}</div></section>`;
}

function renderFlagged(flagged: FlaggedReview[]): string {
  if (flagged.length === 0) {
    return `<section><h2>Flagged reviews</h2><p class="muted">None flagged.</p></section>`;
  }

  const items = flagged
    .slice(0, MAX_FLAGGED)
    .map(
      (review) => `<li>
        <div class="flag-head"><span class="badge">${escapeHtml(review.reason)}</span>
          <span class="muted">${formatScore(review.score)}</span></div>
        <p>${escapeHtml(review.text)}</p>
      </li>`,
    )
    .join('');

  const more =
    flagged.length > MAX_FLAGGED
      ? `<p class="muted">…and ${flagged.length - MAX_FLAGGED} more.</p>`
      : '';

  return `<section>
    <h2>Flagged reviews</h2>
    <ul class="flagged">${items}</ul>
    ${more}
  </section>`;
}

function renderFooter(result: AnalysisResult): string {
  const errors =
    result.errors.length > 0
      ? `${result.errors.length} error(s) during analysis`
      : 'no errors';
  return `<footer class="muted">schema ${escapeHtml(result.schemaVersion)} · ${errors}</footer>`;
}

const STYLES = `
:root { color-scheme: light dark; --fg: #1a1a1a; --muted: #666; --bg: #fff; --card: #f6f6f6; --border: #e0e0e0; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #eee; --muted: #aaa; --bg: #161616; --card: #222; --border: #333; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
main { max-width: 880px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1 { font-size: 1.7rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 0 0 .75rem; }
.lede { color: var(--muted); margin: 0; }
section { margin-top: 2rem; }
.muted { color: var(--muted); }
.bar { width: 100%; height: 14px; border-radius: 4px; overflow: hidden; display: block; }
.legend { list-style: none; padding: 0; margin: .75rem 0 0; display: flex; flex-wrap: wrap; gap: 1rem; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: .4rem; vertical-align: middle; }
.summary { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .5rem .5rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
th { font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
.mentions { position: relative; }
.mention-bar { display: inline-block; height: 8px; background: #1565c0; border-radius: 4px; margin-right: .5rem; vertical-align: middle; min-width: 2px; }
.scroll { overflow-x: auto; }
.trend { min-width: 320px; height: 170px; }
.axis { stroke: var(--border); stroke-width: 1; }
.tick { fill: var(--muted); font-size: 11px; text-anchor: middle; }
.flagged { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
.flagged li { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: .75rem 1rem; }
.flagged p { margin: .4rem 0 0; }
.flag-head { display: flex; align-items: center; gap: .5rem; }
.badge { background: #c62828; color: #fff; border-radius: 999px; padding: .1rem .6rem; font-size: .75rem; }
footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: .85rem; }
`;
