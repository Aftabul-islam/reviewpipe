import { describe, it, expect, vi } from 'vitest';
import type { NormalizedReview } from '@reviewpipe/core';
import { LocalProvider, type Pipe, type PipelineFactory } from './provider.js';

function review(text: string): NormalizedReview {
  return { id: 'r1', text, source: 'test' };
}

/** A pipeline factory that returns canned outputs, so no model is ever loaded. */
function mockFactory(): { factory: PipelineFactory; taskCalls: string[] } {
  const taskCalls: string[] = [];
  const factory: PipelineFactory = async (task) => {
    taskCalls.push(task);
    const pipe: Pipe = async (input) => {
      if (task === 'sentiment-analysis') {
        return input.includes('love')
          ? [{ label: 'POSITIVE', score: 0.99 }]
          : [{ label: 'NEGATIVE', score: 0.95 }];
      }
      return { data: Float32Array.from([0.1, 0.2, 0.3]) };
    };
    return pipe;
  };
  return { factory, taskCalls };
}

describe('LocalProvider', () => {
  it('declares sentiment and embedding capabilities', () => {
    expect(new LocalProvider().capabilities).toEqual({
      sentiment: true,
      embeddings: true,
      summarization: false,
      customPrompts: false,
    });
  });

  it('maps POSITIVE/NEGATIVE model output to signed scores and labels', async () => {
    const provider = new LocalProvider({ createPipeline: mockFactory().factory });

    const positive = await provider.classifySentiment(review('I love this'));
    expect(positive).toEqual({ score: 0.99, label: 'positive', confidence: 0.99 });

    const negative = await provider.classifySentiment(review('broke instantly'));
    expect(negative).toEqual({ score: -0.95, label: 'negative', confidence: 0.95 });
  });

  it('returns a no-signal neutral for empty text without loading a model', async () => {
    const { factory, taskCalls } = mockFactory();
    const result = await new LocalProvider({ createPipeline: factory }).classifySentiment(
      review('   '),
    );
    expect(result).toEqual({ score: 0, label: 'neutral', confidence: 0 });
    expect(taskCalls).toEqual([]);
  });

  it('loads each pipeline once and reuses it across calls', async () => {
    const create = vi.fn(mockFactory().factory);
    const provider = new LocalProvider({ createPipeline: create });

    await provider.classifySentiment(review('I love this'));
    await provider.classifySentiment(review('also great, love it'));
    await provider.embed(review('quality'));
    await provider.embed(review('shipping'));

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map((c) => c[0])).toEqual([
      'sentiment-analysis',
      'feature-extraction',
    ]);
  });

  it('extracts an embedding vector from the model output', async () => {
    const provider = new LocalProvider({ createPipeline: mockFactory().factory });
    expect(await provider.embed(review('great quality'))).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
  });

  it('throws a clear error when @xenova/transformers is not installed', async () => {
    // Uses the real (default) factory; the optional dep is intentionally absent.
    await expect(new LocalProvider().classifySentiment(review('hello'))).rejects.toThrow(
      /@xenova\/transformers/,
    );
  });
});
