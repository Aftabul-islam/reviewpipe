import { describe, it, expect } from 'vitest';
import { Pipeline, type AnalysisResult } from '@reviewpipe/core';
import { LocalProvider } from './provider.js';

// Real models — downloads on first run (cached afterwards). Excluded from the
// normal test run; invoke with `pnpm test:integration` after installing
// `@xenova/transformers`. See this package's README.
describe('LocalProvider (integration — downloads real models)', () => {
  it('classifies obvious sentiment correctly', async () => {
    const provider = new LocalProvider();
    const positive = await provider.classifySentiment({
      id: 'p',
      text: 'I absolutely love this, it is fantastic and works perfectly!',
      source: 't',
    });
    const negative = await provider.classifySentiment({
      id: 'n',
      text: 'Terrible product, it broke immediately and was a complete waste of money.',
      source: 't',
    });
    expect(positive.label).toBe('positive');
    expect(negative.label).toBe('negative');
  });

  it('produces a fixed-length embedding vector', async () => {
    const provider = new LocalProvider();
    const a = await provider.embed({
      id: 'a',
      text: 'great quality product',
      source: 't',
    });
    const b = await provider.embed({ id: 'b', text: 'fast shipping', source: 't' });
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(a.length);
  });

  it('runs through the full pipeline', async () => {
    const reviews = [
      {
        id: '1',
        text: 'Love it, best purchase ever!',
        rating: 5,
        date: '2026-01-01',
        source: 't',
      },
      {
        id: '2',
        text: 'Awful, do not buy this.',
        rating: 1,
        date: '2026-01-02',
        source: 't',
      },
    ];
    const out = await new Pipeline()
      .source({ parse: () => reviews })
      .provider(new LocalProvider())
      .run(null);
    const result = out as AnalysisResult;
    expect(result.overallSentiment.reviewCount).toBe(2);
    expect(result.errors).toEqual([]);
  });
});
