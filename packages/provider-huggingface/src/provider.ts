import type {
  AnalysisProvider,
  NormalizedReview,
  ProviderCapabilities,
  SentimentResult,
} from '@reviewpipe/core';

/** Minimal response shape used from `fetch`, so callers can mock it easily. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Minimal `fetch` signature this provider depends on. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<FetchResponse>;

export interface HuggingFaceProviderOptions {
  /** Hugging Face API token. Required. */
  apiKey: string;
  /** Text-classification model for sentiment. */
  sentimentModel?: string;
  /** Feature-extraction model for embeddings. */
  embeddingModel?: string;
  /** Summarization model. */
  summarizationModel?: string;
  /** Base URL for the Inference API. */
  endpoint?: string;
  /** Max retries on rate-limit (429) / model-loading (503) responses. Default 3. */
  maxRetries?: number;
  /** Backoff before the first retry, doubled each attempt. Default 1000ms. */
  initialBackoffMs?: number;
  /** Pause after this many requests to respect rate limits. Default 5. */
  batchSize?: number;
  /** How long that pause lasts. Default 0 (no pause). */
  batchDelayMs?: number;
  /** Injectable `fetch`, mainly for testing. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Injectable delay, mainly for testing. Defaults to `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULTS = {
  sentimentModel: 'distilbert-base-uncased-finetuned-sst-2-english',
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  summarizationModel: 'sshleifer/distilbart-cnn-12-6',
  endpoint: 'https://api-inference.huggingface.co/models',
  maxRetries: 3,
  initialBackoffMs: 1000,
  batchSize: 5,
  batchDelayMs: 0,
};

// Cap summarization input so we don't post megabytes to a model with a small
// context window; the hosted summarizers truncate anyway.
const MAX_SUMMARY_INPUT_CHARS = 8000;
const RETRYABLE_STATUS = new Set([429, 503]);

/**
 * Sentiment, embeddings, and summarization via the Hugging Face Inference API
 * (Tier 1 — hosted, bring your own token). A thin `fetch` wrapper with no SDK.
 *
 * Retries on `429` (rate limit) and `503` (model loading) with exponential
 * backoff, and optionally paces requests (`batchSize`/`batchDelayMs`). Empty
 * text is scored as a no-signal neutral without a network call.
 *
 * @example
 * ```ts
 * const provider = new HuggingFaceProvider({ apiKey: process.env.HF_TOKEN! });
 * ```
 */
export class HuggingFaceProvider implements AnalysisProvider {
  readonly name = 'huggingface';

  readonly capabilities: ProviderCapabilities = {
    sentiment: true,
    embeddings: true,
    summarization: true,
    customPrompts: false,
  };

  private readonly apiKey: string;
  private readonly sentimentModel: string;
  private readonly embeddingModel: string;
  private readonly summarizationModel: string;
  private readonly endpoint: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly batchSize: number;
  private readonly batchDelayMs: number;
  private readonly fetchFn: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private requestCount = 0;

  constructor(options: HuggingFaceProviderOptions) {
    if (!options.apiKey || options.apiKey.trim() === '') {
      throw new Error('HuggingFaceProvider: an apiKey is required');
    }
    const resolvedFetch =
      options.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!resolvedFetch) {
      throw new Error(
        'HuggingFaceProvider: no fetch available — pass options.fetch or run on Node 18+',
      );
    }

    this.apiKey = options.apiKey;
    this.sentimentModel = options.sentimentModel ?? DEFAULTS.sentimentModel;
    this.embeddingModel = options.embeddingModel ?? DEFAULTS.embeddingModel;
    this.summarizationModel = options.summarizationModel ?? DEFAULTS.summarizationModel;
    this.endpoint = options.endpoint ?? DEFAULTS.endpoint;
    this.maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
    this.initialBackoffMs = options.initialBackoffMs ?? DEFAULTS.initialBackoffMs;
    this.batchSize = options.batchSize ?? DEFAULTS.batchSize;
    this.batchDelayMs = options.batchDelayMs ?? DEFAULTS.batchDelayMs;
    this.fetchFn = resolvedFetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async classifySentiment(review: NormalizedReview): Promise<SentimentResult> {
    if (review.text.trim() === '') return { score: 0, label: 'neutral', confidence: 0 };

    const raw = await this.post(this.sentimentModel, { inputs: review.text });
    return mapSentiment(topPrediction(normalizeClassification(raw)));
  }

  async embed(review: NormalizedReview): Promise<number[]> {
    return toVector(await this.post(this.embeddingModel, { inputs: review.text }));
  }

  async summarize(reviews: NormalizedReview[]): Promise<string> {
    const text = reviews
      .map((review) => review.text)
      .filter((body) => body.trim() !== '')
      .join('\n');
    if (text.trim() === '') return '';

    const raw = await this.post(this.summarizationModel, {
      inputs: text.slice(0, MAX_SUMMARY_INPUT_CHARS),
    });
    return extractSummary(raw);
  }

  private async post(model: string, payload: Record<string, unknown>): Promise<unknown> {
    await this.pace();
    const url = `${this.endpoint}/${model}`;
    const body = JSON.stringify({ ...payload, options: { wait_for_model: true } });

    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      if (response.ok) return response.json();

      if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(this.initialBackoffMs * 2 ** attempt);
        continue;
      }
      throw new Error(
        `HuggingFaceProvider: request to ${model} failed (${response.status}): ${await safeText(response)}`,
      );
    }
  }

  private async pace(): Promise<void> {
    if (
      this.batchSize > 0 &&
      this.requestCount > 0 &&
      this.requestCount % this.batchSize === 0
    ) {
      await this.sleep(this.batchDelayMs);
    }
    this.requestCount += 1;
  }
}

interface Classification {
  label: string;
  score: number;
}

function normalizeClassification(raw: unknown): Classification[] {
  const list = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
  if (Array.isArray(list)) {
    const predictions = list.filter(isClassification);
    if (predictions.length > 0) return predictions;
  }
  throw new Error('HuggingFaceProvider: unexpected classification response');
}

function isClassification(value: unknown): value is Classification {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.label === 'string' && typeof record.score === 'number';
}

function topPrediction(predictions: Classification[]): Classification {
  return predictions.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
}

function mapSentiment(top: Classification): SentimentResult {
  const label = top.label.toUpperCase();
  if (label.includes('POS'))
    return { score: top.score, label: 'positive', confidence: top.score };
  if (label.includes('NEG'))
    return { score: -top.score, label: 'negative', confidence: top.score };
  return { score: 0, label: 'neutral', confidence: top.score };
}

function toVector(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    if (raw.every((value): value is number => typeof value === 'number')) return raw;
    if (raw.every((row): row is number[] => Array.isArray(row) && row.every(isNumber))) {
      return meanPool(raw);
    }
  }
  throw new Error('HuggingFaceProvider: unexpected embedding response');
}

function meanPool(rows: number[][]): number[] {
  const dim = rows[0]?.length ?? 0;
  const out: number[] = Array.from({ length: dim }, () => 0);
  for (const row of rows) {
    for (let i = 0; i < dim; i += 1) out[i] = (out[i] ?? 0) + (row[i] ?? 0);
  }
  return out.map((value) => value / rows.length);
}

function extractSummary(raw: unknown): string {
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (item && typeof item === 'object') {
    const summary = (item as Record<string, unknown>).summary_text;
    if (typeof summary === 'string') return summary;
  }
  throw new Error('HuggingFaceProvider: unexpected summarization response');
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

async function safeText(response: FetchResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
