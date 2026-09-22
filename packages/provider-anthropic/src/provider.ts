import type {
  AnalysisProvider,
  NormalizedReview,
  ProviderCapabilities,
  SentimentResult,
  SentimentLabel,
} from '@reviewpipe/core';

/**
 * System prompt used for summarization. Exported so callers can inspect it or
 * pass their own via the `promptOverride` constructor option.
 */
export const SUMMARY_PROMPT =
  'You are summarizing a collection of customer product reviews. Write a concise, ' +
  'neutral summary of 3-5 sentences capturing the main themes, the most common praise, ' +
  'and the most common complaints. Only use information present in the reviews; do not ' +
  'invent details.';

/** System prompt used for sentiment classification. */
export const SENTIMENT_PROMPT =
  'You are a sentiment analysis engine for product reviews. Respond with ONLY a compact ' +
  'JSON object of the form {"score": <number between -1 and 1>, "label": ' +
  '"positive"|"neutral"|"negative"}. The label must agree with the score (> 0.05 positive, ' +
  '< -0.05 negative, otherwise neutral). Output no text outside the JSON.';

const DEFAULT_MODEL = 'claude-opus-4-8';
const SENTIMENT_MAX_TOKENS = 128;
const SUMMARY_MAX_TOKENS = 1024;
const MAX_SUMMARY_INPUT_CHARS = 12000;

/** Completes a single system+user exchange; injectable to avoid the SDK in tests. */
export type AnthropicComplete = (request: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
}) => Promise<string>;

export interface AnthropicProviderOptions {
  /** Anthropic API key. Required unless a custom `complete` is supplied. */
  apiKey?: string;
  /** Model id. Defaults to `claude-opus-4-8`. */
  model?: string;
  /** Override the summarization system prompt. */
  promptOverride?: string;
  /** Custom completion function, mainly for testing without the SDK. */
  complete?: AnthropicComplete;
}

/**
 * Frontier provider (Tier 2) backed by Anthropic's Claude models via the
 * official SDK. Sentiment and summarization are done by prompting; Anthropic
 * has no embeddings endpoint, so `embeddings` is false. `customPrompts` is true
 * — override the summary prompt with `promptOverride`.
 *
 * `@anthropic-ai/sdk` is an optional dependency loaded lazily on first use.
 * Empty text is scored as a no-signal neutral without an API call.
 *
 * @example
 * ```ts
 * const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });
 * ```
 */
export class AnthropicProvider implements AnalysisProvider {
  readonly name = 'anthropic';

  readonly capabilities: ProviderCapabilities = {
    sentiment: true,
    embeddings: false,
    summarization: true,
    customPrompts: true,
  };

  private readonly model: string;
  private readonly summaryPrompt: string;
  private readonly complete: AnthropicComplete;

  constructor(options: AnthropicProviderOptions = {}) {
    if (!options.complete && (!options.apiKey || options.apiKey.trim() === '')) {
      throw new Error(
        'AnthropicProvider: an apiKey is required (or supply a custom complete)',
      );
    }
    this.model = options.model ?? DEFAULT_MODEL;
    this.summaryPrompt = options.promptOverride ?? SUMMARY_PROMPT;
    this.complete = options.complete ?? createDefaultComplete(options.apiKey ?? '');
  }

  async classifySentiment(review: NormalizedReview): Promise<SentimentResult> {
    if (review.text.trim() === '') return { score: 0, label: 'neutral', confidence: 0 };

    const raw = await this.complete({
      system: SENTIMENT_PROMPT,
      user: review.text,
      model: this.model,
      maxTokens: SENTIMENT_MAX_TOKENS,
    });
    return parseSentiment(raw);
  }

  async summarize(reviews: NormalizedReview[]): Promise<string> {
    const text = joinReviews(reviews);
    if (text === '') return '';

    return (
      await this.complete({
        system: this.summaryPrompt,
        user: text,
        model: this.model,
        maxTokens: SUMMARY_MAX_TOKENS,
      })
    ).trim();
  }
}

interface AnthropicModule {
  default: new (options: { apiKey: string }) => {
    messages: {
      create(params: {
        model: string;
        max_tokens: number;
        system: string;
        messages: { role: 'user'; content: string }[];
      }): Promise<{ content: unknown[] }>;
    };
  };
}

function createDefaultComplete(apiKey: string): AnthropicComplete {
  return async ({ system, user, model, maxTokens }) => {
    // Non-literal specifier so the optional dependency is resolved at runtime,
    // not by the type checker — this package must typecheck with it uninstalled.
    const specifier: string = '@anthropic-ai/sdk';
    let mod: AnthropicModule;
    try {
      mod = (await import(specifier)) as unknown as AnthropicModule;
    } catch (error) {
      throw new Error(
        'AnthropicProvider requires the optional dependency "@anthropic-ai/sdk", which is ' +
          'not installed. Add it where you use AnthropicProvider (e.g. `pnpm add @anthropic-ai/sdk`). ' +
          `Underlying error: ${errorMessage(error)}`,
      );
    }
    const client = new mod.default({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return extractText(response.content);
  };
}

function extractText(content: unknown[]): string {
  return content
    .map((block) => {
      if (block && typeof block === 'object') {
        const record = block as { type?: unknown; text?: unknown };
        if (record.type === 'text' && typeof record.text === 'string') return record.text;
      }
      return '';
    })
    .join('');
}

export function parseSentiment(raw: string): SentimentResult {
  const parsed = extractJson(raw);
  if (parsed && typeof parsed === 'object') {
    const record = parsed as { score?: unknown; label?: unknown };
    if (typeof record.score === 'number' && Number.isFinite(record.score)) {
      const score = clamp(record.score, -1, 1);
      const label = isLabel(record.label) ? record.label : labelFor(score);
      return { score, label, confidence: Math.abs(score) };
    }
  }
  throw new Error(
    'AnthropicProvider: could not parse a sentiment score from the model response',
  );
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function isLabel(value: unknown): value is SentimentLabel {
  return value === 'positive' || value === 'neutral' || value === 'negative';
}

function labelFor(score: number): SentimentLabel {
  if (score > 0.05) return 'positive';
  if (score < -0.05) return 'negative';
  return 'neutral';
}

function joinReviews(reviews: NormalizedReview[]): string {
  return reviews
    .map((review) => review.text)
    .filter((body) => body.trim() !== '')
    .join('\n')
    .slice(0, MAX_SUMMARY_INPUT_CHARS);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
