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

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_SUMMARY_INPUT_CHARS = 12000;

/** Completes a single system+user chat exchange; injectable to avoid the SDK in tests. */
export type OpenAIChat = (request: {
  system: string;
  user: string;
  model: string;
}) => Promise<string>;

/** Produces an embedding vector for text; injectable to avoid the SDK in tests. */
export type OpenAIEmbed = (request: {
  input: string;
  model: string;
}) => Promise<number[]>;

export interface OpenAIProviderOptions {
  /** OpenAI API key. Required unless custom `chat`/`embed` are supplied. */
  apiKey?: string;
  /** Chat model id. Defaults to `gpt-4o-mini`. */
  model?: string;
  /** Embedding model id. Defaults to `text-embedding-3-small`. */
  embeddingModel?: string;
  /** Override the summarization system prompt. */
  promptOverride?: string;
  /** Custom chat function, mainly for testing without the SDK. */
  chat?: OpenAIChat;
  /** Custom embedding function, mainly for testing without the SDK. */
  embed?: OpenAIEmbed;
}

/**
 * Frontier provider (Tier 2) backed by OpenAI models via the official SDK.
 * Sentiment and summarization are done by prompting; embeddings use the
 * embeddings endpoint. `customPrompts` is true — override the summary prompt
 * with `promptOverride`.
 *
 * `openai` is an optional dependency loaded lazily on first use. Empty text is
 * scored as a no-signal neutral without an API call.
 *
 * @example
 * ```ts
 * const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! });
 * ```
 */
export class OpenAIProvider implements AnalysisProvider {
  readonly name = 'openai';

  readonly capabilities: ProviderCapabilities = {
    sentiment: true,
    embeddings: true,
    summarization: true,
    customPrompts: true,
  };

  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly summaryPrompt: string;
  private readonly chatFn: OpenAIChat;
  private readonly embedFn: OpenAIEmbed;

  constructor(options: OpenAIProviderOptions = {}) {
    const hasInjected = options.chat && options.embed;
    if (!hasInjected && (!options.apiKey || options.apiKey.trim() === '')) {
      throw new Error(
        'OpenAIProvider: an apiKey is required (or supply custom chat/embed)',
      );
    }
    this.model = options.model ?? DEFAULT_MODEL;
    this.embeddingModel = options.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    this.summaryPrompt = options.promptOverride ?? SUMMARY_PROMPT;
    this.chatFn = options.chat ?? createDefaultChat(options.apiKey ?? '');
    this.embedFn = options.embed ?? createDefaultEmbed(options.apiKey ?? '');
  }

  async classifySentiment(review: NormalizedReview): Promise<SentimentResult> {
    if (review.text.trim() === '') return { score: 0, label: 'neutral', confidence: 0 };

    const raw = await this.chatFn({
      system: SENTIMENT_PROMPT,
      user: review.text,
      model: this.model,
    });
    return parseSentiment(raw);
  }

  async embed(review: NormalizedReview): Promise<number[]> {
    return this.embedFn({ input: review.text, model: this.embeddingModel });
  }

  async summarize(reviews: NormalizedReview[]): Promise<string> {
    const text = joinReviews(reviews);
    if (text === '') return '';

    return (
      await this.chatFn({ system: this.summaryPrompt, user: text, model: this.model })
    ).trim();
  }
}

interface OpenAIModule {
  default: new (options: { apiKey: string }) => OpenAIClient;
}

interface OpenAIClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: { role: 'system' | 'user'; content: string }[];
      }): Promise<{ choices: { message: { content: string | null } }[] }>;
    };
  };
  embeddings: {
    create(params: {
      model: string;
      input: string;
    }): Promise<{ data: { embedding: number[] }[] }>;
  };
}

async function loadClient(apiKey: string): Promise<OpenAIClient> {
  // Non-literal specifier so the optional dependency is resolved at runtime,
  // not by the type checker — this package must typecheck with it uninstalled.
  const specifier: string = 'openai';
  let mod: OpenAIModule;
  try {
    mod = (await import(specifier)) as unknown as OpenAIModule;
  } catch (error) {
    throw new Error(
      'OpenAIProvider requires the optional dependency "openai", which is not installed. ' +
        'Add it where you use OpenAIProvider (e.g. `pnpm add openai`). ' +
        `Underlying error: ${errorMessage(error)}`,
    );
  }
  return new mod.default({ apiKey });
}

function createDefaultChat(apiKey: string): OpenAIChat {
  return async ({ system, user, model }) => {
    const client = await loadClient(apiKey);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return response.choices[0]?.message.content ?? '';
  };
}

function createDefaultEmbed(apiKey: string): OpenAIEmbed {
  return async ({ input, model }) => {
    const client = await loadClient(apiKey);
    const response = await client.embeddings.create({ model, input });
    const embedding = response.data[0]?.embedding;
    if (!embedding) throw new Error('OpenAIProvider: no embedding returned');
    return embedding;
  };
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
    'OpenAIProvider: could not parse a sentiment score from the model response',
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
