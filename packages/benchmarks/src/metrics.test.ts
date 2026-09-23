import { describe, it, expect } from 'vitest';
import type { SentimentLabel } from '@reviewpipe/core';
import { computeMetrics } from './metrics.js';
import { parseLabeledCsv } from './dataset.js';

function pair(gold: SentimentLabel, predicted: SentimentLabel) {
  return { gold, predicted };
}

describe('computeMetrics', () => {
  it('reports perfect metrics when every prediction is correct', () => {
    const metrics = computeMetrics([
      pair('positive', 'positive'),
      pair('negative', 'negative'),
      pair('neutral', 'neutral'),
    ]);
    expect(metrics.accuracy).toBe(1);
    expect(metrics.macroF1).toBe(1);
    expect(metrics.perClass.positive).toEqual({
      precision: 1,
      recall: 1,
      f1: 1,
      support: 1,
    });
  });

  it('computes precision, recall, and F1 per class', () => {
    // 2 positives: one correct, one predicted negative. 1 negative predicted positive.
    const metrics = computeMetrics([
      pair('positive', 'positive'),
      pair('positive', 'negative'),
      pair('negative', 'positive'),
    ]);
    // positive: tp=1, fp=1 (the negative), fn=1 (the misclassified positive)
    expect(metrics.perClass.positive.precision).toBeCloseTo(0.5);
    expect(metrics.perClass.positive.recall).toBeCloseTo(0.5);
    expect(metrics.perClass.positive.f1).toBeCloseTo(0.5);
    expect(metrics.perClass.positive.support).toBe(2);
    expect(metrics.accuracy).toBeCloseTo(1 / 3);
  });

  it('yields 0 (not NaN) for a class that is never predicted or present', () => {
    const metrics = computeMetrics([pair('positive', 'positive')]);
    expect(metrics.perClass.negative).toEqual({
      precision: 0,
      recall: 0,
      f1: 0,
      support: 0,
    });
    expect(Number.isNaN(metrics.macroF1)).toBe(false);
  });

  it('returns all-zero metrics for empty input', () => {
    const metrics = computeMetrics([]);
    expect(metrics.total).toBe(0);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.macroF1).toBe(0);
  });
});

describe('parseLabeledCsv', () => {
  it('parses labeled rows and skips rows with an invalid label', () => {
    const rows = parseLabeledCsv(
      'id,text,label\n1,good,positive\n2,meh,neutral\n3,bad,unknown\n',
    );
    expect(rows).toEqual([
      { id: '1', text: 'good', label: 'positive' },
      { id: '2', text: 'meh', label: 'neutral' },
    ]);
  });
});
