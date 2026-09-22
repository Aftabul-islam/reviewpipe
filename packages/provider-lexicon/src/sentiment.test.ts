import { describe, it, expect } from 'vitest';
import { scoreSentiment } from './sentiment.js';

describe('scoreSentiment — direction', () => {
  it('scores clearly positive text as positive', () => {
    const positive = [
      'Absolutely love this product, exceeded my expectations in every way!',
      'Great quality and fast shipping, very happy with it.',
      'Perfect fit, excellent material, will buy again.',
    ];
    for (const text of positive) {
      expect(scoreSentiment(text).label).toBe('positive');
    }
  });

  it('scores clearly negative text as negative', () => {
    const negative = [
      'This is the worst purchase I have ever made. Complete waste of money.',
      'Terrible quality, arrived broken and the packaging was inadequate.',
      'Awful experience, disappointed and frustrated.',
    ];
    for (const text of negative) {
      expect(scoreSentiment(text).label).toBe('negative');
    }
  });

  it('treats text with no sentiment words as a no-signal neutral', () => {
    const result = scoreSentiment('The item arrived on Tuesday.');
    expect(result.label).toBe('neutral');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns a no-signal neutral for empty or whitespace input', () => {
    for (const text of ['', '   ', '\n\t']) {
      expect(scoreSentiment(text)).toEqual({ score: 0, label: 'neutral', confidence: 0 });
    }
  });
});

describe('scoreSentiment — negation', () => {
  it('flips a positive word after a negator', () => {
    const negated = scoreSentiment('This is not good.');
    const plain = scoreSentiment('This is good.');
    expect(plain.label).toBe('positive');
    expect(negated.score).toBeLessThan(0);
  });

  it('flips a negative word after a negator', () => {
    expect(scoreSentiment('It is not terrible.').score).toBeGreaterThan(0);
  });
});

describe('scoreSentiment — confidence', () => {
  it('is bounded to [0, 1] and non-zero when sentiment words are present', () => {
    const result = scoreSentiment('amazing amazing amazing wonderful perfect excellent');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
