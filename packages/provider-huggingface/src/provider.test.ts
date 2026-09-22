import { describe, it, expect, vi } from 'vitest';
import type { NormalizedReview } from '@reviewpipe/core';
import { HuggingFaceProvider, type FetchLike, type FetchResponse } from './provider.js';

function review(text: string): NormalizedReview {
  return { id: 'r1', text, source: 'test' };
}

function ok(data: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function fail(status: number, body = 'error'): FetchResponse {
  return { ok: false, status, json: async () => ({}), text: async () => body };
}

/** A fetch mock that returns queued responses in order. */
function fetchReturning(...responses: FetchResponse[]): FetchLike {
  let i = 0;
  return vi.fn(async () => responses[Math.min(i++, responses.length - 1)]!);
}

const noSleep = (): Promise<void> => Promise.resolve();

function makeProvider(fetchFn: FetchLike, overrides = {}): HuggingFaceProvider {
  return new HuggingFaceProvider({
    apiKey: 'hf_test',
    fetch: fetchFn,
    sleep: noSleep,
    ...overrides,
  });
}

describe('HuggingFaceProvider — construction', () => {
  it('throws without an apiKey', () => {
    expect(() => new HuggingFaceProvider({ apiKey: '' })).toThrow(/apiKey is required/);
  });

  it('declares all three capabilities', () => {
    expect(makeProvider(fetchReturning(ok([]))).capabilities).toEqual({
      sentiment: true,
      embeddings: true,
      summarization: true,
      customPrompts: false,
    });
  });
});

describe('HuggingFaceProvider — classifySentiment', () => {
  it('maps POSITIVE/NEGATIVE from a nested classification response', async () => {
    const positive = makeProvider(
      fetchReturning(
        ok([
          [
            { label: 'POSITIVE', score: 0.97 },
            { label: 'NEGATIVE', score: 0.03 },
          ],
        ]),
      ),
    );
    expect(await positive.classifySentiment(review('love it'))).toEqual({
      score: 0.97,
      label: 'positive',
      confidence: 0.97,
    });

    const negative = makeProvider(
      fetchReturning(ok([{ label: 'NEGATIVE', score: 0.88 }])),
    );
    expect(await negative.classifySentiment(review('hate it'))).toEqual({
      score: -0.88,
      label: 'negative',
      confidence: 0.88,
    });
  });

  it('scores empty text as no-signal neutral without calling the API', async () => {
    const fetchFn = fetchReturning(ok([]));
    const result = await makeProvider(fetchFn).classifySentiment(review('   '));
    expect(result).toEqual({ score: 0, label: 'neutral', confidence: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends the token and model URL', async () => {
    const fetchFn = fetchReturning(ok([{ label: 'POSITIVE', score: 0.9 }]));
    await makeProvider(fetchFn, { sentimentModel: 'my/model' }).classifySentiment(
      review('hi'),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/my/model',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer hf_test' }),
      }),
    );
  });
});

describe('HuggingFaceProvider — embed and summarize', () => {
  it('returns a 1D embedding directly and mean-pools a 2D response', async () => {
    expect(
      await makeProvider(fetchReturning(ok([0.1, 0.2, 0.3]))).embed(review('x')),
    ).toEqual([0.1, 0.2, 0.3]);

    const pooled = await makeProvider(
      fetchReturning(
        ok([
          [0, 2, 4],
          [2, 4, 6],
        ]),
      ),
    ).embed(review('x'));
    expect(pooled).toEqual([1, 3, 5]);
  });

  it('joins reviews and returns the summary text', async () => {
    const fetchFn = fetchReturning(ok([{ summary_text: 'Mostly positive.' }]));
    const summary = await makeProvider(fetchFn).summarize([review('a'), review('b')]);
    expect(summary).toBe('Mostly positive.');
    const body = JSON.parse(
      (fetchFn as unknown as { mock: { calls: [string, { body: string }][] } }).mock
        .calls[0]![1].body,
    );
    expect(body.inputs).toBe('a\nb');
  });
});

describe('HuggingFaceProvider — rate limiting', () => {
  it('retries on 429 with exponential backoff, then succeeds', async () => {
    const fetchFn = fetchReturning(
      fail(429),
      fail(429),
      ok([{ label: 'POSITIVE', score: 0.9 }]),
    );
    const sleeps: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      sleeps.push(ms);
      return Promise.resolve();
    };
    const provider = new HuggingFaceProvider({ apiKey: 'k', fetch: fetchFn, sleep });

    const result = await provider.classifySentiment(review('hi'));
    expect(result.label).toBe('positive');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it('gives up after maxRetries and throws with the status', async () => {
    const fetchFn = fetchReturning(fail(503, 'loading'));
    const provider = new HuggingFaceProvider({
      apiKey: 'k',
      fetch: fetchFn,
      sleep: noSleep,
      maxRetries: 2,
    });

    await expect(provider.classifySentiment(review('hi'))).rejects.toThrow(
      /failed \(503\)/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    const fetchFn = fetchReturning(fail(400, 'bad request'));
    await expect(makeProvider(fetchFn).classifySentiment(review('hi'))).rejects.toThrow(
      /failed \(400\)/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('pauses after every batchSize requests', async () => {
    const fetchFn = fetchReturning(ok([{ label: 'POSITIVE', score: 0.9 }]));
    const sleeps: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      sleeps.push(ms);
      return Promise.resolve();
    };
    const provider = new HuggingFaceProvider({
      apiKey: 'k',
      fetch: fetchFn,
      sleep,
      batchSize: 2,
      batchDelayMs: 500,
    });

    for (let i = 0; i < 5; i += 1) await provider.classifySentiment(review(`t${i}`));
    // Requests 3 and 5 trigger the pause (after 2 and 4 prior requests).
    expect(sleeps.filter((ms) => ms === 500)).toHaveLength(2);
  });
});
