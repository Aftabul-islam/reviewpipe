import type { SentimentLabel } from '@reviewpipe/core';

export const LABELS: readonly SentimentLabel[] = ['positive', 'neutral', 'negative'];

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface BenchmarkMetrics {
  total: number;
  accuracy: number;
  macroF1: number;
  perClass: Record<SentimentLabel, ClassMetrics>;
}

/**
 * Compute accuracy plus per-class precision/recall/F1 and the macro-averaged F1
 * for predicted vs. gold sentiment labels. Precision, recall, and F1 are `0`
 * when their denominator is `0` (e.g. a class never predicted), rather than
 * `NaN`. Empty input yields all-zero metrics.
 */
export function computeMetrics(
  pairs: { gold: SentimentLabel; predicted: SentimentLabel }[],
): BenchmarkMetrics {
  const perClass = {} as Record<SentimentLabel, ClassMetrics>;
  let correct = 0;

  for (const label of LABELS) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const { gold, predicted } of pairs) {
      if (gold === label && predicted === label) tp += 1;
      else if (predicted === label && gold !== label) fp += 1;
      else if (gold === label && predicted !== label) fn += 1;
    }
    const precision = ratio(tp, tp + fp);
    const recall = ratio(tp, tp + fn);
    perClass[label] = {
      precision,
      recall,
      f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
      support: tp + fn,
    };
  }

  for (const { gold, predicted } of pairs) {
    if (gold === predicted) correct += 1;
  }

  const macroF1 =
    LABELS.reduce((sum, label) => sum + perClass[label].f1, 0) / LABELS.length;
  return {
    total: pairs.length,
    accuracy: ratio(correct, pairs.length),
    macroF1,
    perClass,
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
