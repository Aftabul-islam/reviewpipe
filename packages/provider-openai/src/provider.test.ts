import { describe, it, expect, vi } from 'vitest';
import { Pipeline, type NormalizedReview } from '@reviewpipe/core';
import {
  OpenAIProvider,
  SUMMARY_PROMPT,
  type OpenAIChat,
  type OpenAIEmbed,
} from './provider.js';

function review(text: string): NormalizedReview {
  return { id: 'r1', text, source: 'test' };
}

const stubEmbed: OpenAIEmbed = async () => [0.1, 0.2];

describe('OpenAIProvider — construction', () => {
  it('throws without an apiKey and without injected functions', () => {
    expect(() => new OpenAIProvider()).toThrow(/apiKey is required/);
  });

  it('declares all four capabilities', () => {
    const provider = new OpenAIProvider({ chat: async () => '{}', embed: stubEmbed });
    expect(provider.capabilities).toEqual({
      sentiment: true,
      embeddings: true,
      summarization: true,
      customPrompts: true,
    });
  });
});

describe('OpenAIProvider — sentiment, embed, summarize', () => {
  it('parses a JSON sentiment response', async () => {
    const provider = new OpenAIProvider({
      chat: async () => '{"score": -0.9, "label": "negative"}',
      embed: stubEmbed,
    });
    expect(await provider.classifySentiment(review('awful'))).toEqual({
      score: -0.9,
      label: 'negative',
      confidence: 0.9,
    });
  });

  it('scores empty text as no-signal neutral without calling chat', async () => {
    const chat = vi.fn<OpenAIChat>(async () => '{"score":1}');
    const result = await new OpenAIProvider({ chat, embed: stubEmbed }).classifySentiment(
      review(''),
    );
    expect(result).toEqual({ score: 0, label: 'neutral', confidence: 0 });
    expect(chat).not.toHaveBeenCalled();
  });

  it('returns the embedding vector', async () => {
    const provider = new OpenAIProvider({
      chat: async () => '{}',
      embed: async ({ input, model }) => (input === 'hi' && model ? [1, 2, 3] : []),
    });
    expect(await provider.embed(review('hi'))).toEqual([1, 2, 3]);
  });

  it('summarizes with the summary prompt and trims the result', async () => {
    let seenSystem = '';
    const provider = new OpenAIProvider({
      chat: async ({ system }) => {
        seenSystem = system;
        return '  Good overall.  ';
      },
      embed: stubEmbed,
    });
    expect(await provider.summarize([review('a')])).toBe('Good overall.');
    expect(seenSystem).toBe(SUMMARY_PROMPT);
  });
});

describe('OpenAIProvider — through the pipeline', () => {
  it('classifies and summarizes an end-to-end run', async () => {
    const provider = new OpenAIProvider({
      chat: async ({ system, user }) => {
        if (system === SUMMARY_PROMPT) return 'Two reviews, mixed.';
        return user.includes('love')
          ? '{"score":0.9,"label":"positive"}'
          : '{"score":-0.9,"label":"negative"}';
      },
      embed: stubEmbed,
    });

    const reviews: NormalizedReview[] = [
      { id: 'a', text: 'love it', source: 't' },
      { id: 'b', text: 'hate it', source: 't' },
    ];
    const out = await new Pipeline()
      .source({ parse: () => reviews })
      .provider(provider)
      .run(null);
    if (typeof out === 'string' || out instanceof Uint8Array)
      throw new Error('unexpected output');

    expect(out.overallSentiment.positive).toBe(1);
    expect(out.overallSentiment.negative).toBe(1);
    expect(out.summary).toBe('Two reviews, mixed.');
    expect(out.errors).toEqual([]);
  });
});
