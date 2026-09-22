import { describe, it, expect, vi } from 'vitest';
import type { NormalizedReview } from '@reviewpipe/core';
import { AnthropicProvider, SUMMARY_PROMPT, type AnthropicComplete } from './provider.js';

function review(text: string): NormalizedReview {
  return { id: 'r1', text, source: 'test' };
}

describe('AnthropicProvider — construction', () => {
  it('throws without an apiKey and without an injected complete', () => {
    expect(() => new AnthropicProvider()).toThrow(/apiKey is required/);
  });

  it('declares sentiment + summarization but not embeddings', () => {
    const provider = new AnthropicProvider({ complete: async () => '{}' });
    expect(provider.capabilities).toEqual({
      sentiment: true,
      embeddings: false,
      summarization: true,
      customPrompts: true,
    });
    expect((provider as { embed?: unknown }).embed).toBeUndefined();
  });
});

describe('AnthropicProvider — classifySentiment', () => {
  it('parses a JSON sentiment response', async () => {
    const provider = new AnthropicProvider({
      complete: async () => '{"score": 0.8, "label": "positive"}',
    });
    expect(await provider.classifySentiment(review('great'))).toEqual({
      score: 0.8,
      label: 'positive',
      confidence: 0.8,
    });
  });

  it('tolerates surrounding prose and derives a missing label from the score', async () => {
    const provider = new AnthropicProvider({
      complete: async () => 'Here you go: {"score": -0.6} — hope that helps',
    });
    const result = await provider.classifySentiment(review('bad'));
    expect(result.score).toBe(-0.6);
    expect(result.label).toBe('negative');
  });

  it('scores empty text as no-signal neutral without calling the model', async () => {
    const complete = vi.fn<AnthropicComplete>(async () => '{"score":1}');
    const result = await new AnthropicProvider({ complete }).classifySentiment(
      review('  '),
    );
    expect(result).toEqual({ score: 0, label: 'neutral', confidence: 0 });
    expect(complete).not.toHaveBeenCalled();
  });

  it('throws when the response has no parseable score', async () => {
    const provider = new AnthropicProvider({ complete: async () => 'no json here' });
    await expect(provider.classifySentiment(review('x'))).rejects.toThrow(
      /could not parse/,
    );
  });
});

describe('AnthropicProvider — summarize', () => {
  it('sends the summary prompt and joined reviews, and trims the result', async () => {
    const calls: { system: string; user: string }[] = [];
    const provider = new AnthropicProvider({
      complete: async ({ system, user }) => {
        calls.push({ system, user });
        return '  Mostly positive.  ';
      },
    });

    const summary = await provider.summarize([review('a'), review(''), review('b')]);
    expect(summary).toBe('Mostly positive.');
    expect(calls[0]?.system).toBe(SUMMARY_PROMPT);
    expect(calls[0]?.user).toBe('a\nb');
  });

  it('uses a prompt override when provided', async () => {
    let seenSystem = '';
    const provider = new AnthropicProvider({
      promptOverride: 'CUSTOM PROMPT',
      complete: async ({ system }) => {
        seenSystem = system;
        return 'ok';
      },
    });
    await provider.summarize([review('a')]);
    expect(seenSystem).toBe('CUSTOM PROMPT');
  });

  it('returns empty string for an all-empty review set without calling the model', async () => {
    const complete = vi.fn<AnthropicComplete>(async () => 'x');
    expect(await new AnthropicProvider({ complete }).summarize([review('')])).toBe('');
    expect(complete).not.toHaveBeenCalled();
  });
});
