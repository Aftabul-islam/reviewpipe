import { describe, it, expect } from 'vitest';
import { Pipeline } from './pipeline.js';
import type { NormalizedReview } from './schema.js';
import type {
  AnalysisProvider,
  SourceAdapter,
  Transformer,
  SentimentResult,
} from './interfaces.js';

const reviews: NormalizedReview[] = [{ id: 'a', text: 'ok', source: 't' }];
const arrayAdapter: SourceAdapter = { parse: () => reviews };
const neutralProvider: AnalysisProvider = {
  name: 'stub',
  capabilities: {
    sentiment: true,
    embeddings: false,
    summarization: false,
    customPrompts: false,
  },
  classifySentiment: (): SentimentResult => ({ score: 0, label: 'neutral' }),
};

describe('Pipeline — fatal-stage failures', () => {
  it('propagates an adapter parse failure (nothing to analyze)', async () => {
    const adapter: SourceAdapter = {
      parse: () => {
        throw new Error('bad input');
      },
    };
    await expect(
      new Pipeline().source(adapter).provider(neutralProvider).run('x'),
    ).rejects.toThrow('bad input');
  });

  it('propagates a transformer failure', async () => {
    const transformer: Transformer = {
      transform: () => {
        throw new Error('transform boom');
      },
    };
    await expect(
      new Pipeline()
        .source(arrayAdapter)
        .use(transformer)
        .provider(neutralProvider)
        .run(null),
    ).rejects.toThrow('transform boom');
  });
});
