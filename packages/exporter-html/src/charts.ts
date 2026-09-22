import type { OverallSentiment, TrendPoint } from '@reviewpipe/core';
import { escapeHtml, percent, round } from './html.js';

/** Sentiment colors, reused by charts and legends. */
export const COLORS = {
  positive: '#2e7d32',
  neutral: '#9e9e9e',
  negative: '#c62828',
} as const;

/**
 * A 100%-width stacked bar showing the positive/neutral/negative split. Renders
 * an empty track when there are no scored reviews.
 */
export function sentimentBar(overall: OverallSentiment): string {
  const { positive, neutral, reviewCount } = overall;
  const pos = percent(positive, reviewCount);
  const neu = percent(neutral, reviewCount);
  const neg = Math.max(0, 100 - pos - neu);

  const segments = [
    { width: pos, fill: COLORS.positive },
    { width: neu, fill: COLORS.neutral },
    { width: neg, fill: COLORS.negative },
  ];

  let offset = 0;
  const rects = segments
    .filter((segment) => segment.width > 0)
    .map((segment) => {
      const rect = `<rect x="${offset}" y="0" width="${segment.width}" height="12" fill="${segment.fill}" />`;
      offset += segment.width;
      return rect;
    })
    .join('');

  return `<svg class="bar" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label="Sentiment split">${
    rects || '<rect x="0" y="0" width="100" height="12" fill="#e0e0e0" />'
  }</svg>`;
}

/**
 * A zero-baseline bar chart of average sentiment per period. Positive bars rise
 * above the baseline, negative fall below. Returns an empty string when there
 * is no trend data (the caller shows a placeholder instead).
 */
export function trendChart(trend: TrendPoint[]): string {
  if (trend.length === 0) return '';

  const slot = 56;
  const barWidth = 36;
  const maxBar = 60;
  const midline = 80;
  const height = 170;
  const width = trend.length * slot;

  const bars = trend
    .map((point, index) => {
      const x = index * slot + (slot - barWidth) / 2;
      const magnitude = Math.min(Math.abs(point.averageSentiment), 1) * maxBar;
      const up = point.averageSentiment >= 0;
      const y = up ? midline - magnitude : midline;
      const fill = up ? COLORS.positive : COLORS.negative;
      return (
        `<rect x="${round(x)}" y="${round(y)}" width="${barWidth}" height="${round(magnitude)}" rx="3" fill="${fill}" />` +
        `<text x="${round(x + barWidth / 2)}" y="${height - 20}" class="tick">${escapeHtml(point.period)}</text>` +
        `<text x="${round(x + barWidth / 2)}" y="${height - 6}" class="tick muted">${point.averageSentiment.toFixed(2)}</text>`
      );
    })
    .join('');

  return `<svg class="trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sentiment over time">
    <line x1="0" y1="${midline}" x2="${width}" y2="${midline}" class="axis" />
    ${bars}
  </svg>`;
}
