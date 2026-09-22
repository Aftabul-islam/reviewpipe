/** Escape text for safe interpolation into HTML/SVG markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a sentiment score in `[-1, 1]` to two decimals with a sign. */
export function formatScore(score: number): string {
  return `${score >= 0 ? '+' : ''}${score.toFixed(2)}`;
}

/** Round to at most one decimal — keeps generated SVG coordinates tidy. */
export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Whole-number percentage of `part` out of `total`; `0` when `total` is `0`. */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
