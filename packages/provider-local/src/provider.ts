import type {
  AnalysisProvider,
  NormalizedReview,
  ProviderCapabilities,
  SentimentResult,
} from '@reviewpipe/core';

/** A transformers.js pipeline instance: call it with text to get a prediction. */
export type Pipe = (input: string, options?: Record<string, unknown>) => Promise<unknown>;

/**
 * Builds a pipeline for a task/model. The default loads `@xenova/transformers`;
 * inject a custom one to run without the ML dependency (used by unit tests).
 */
export type PipelineFactory = (task: string, model: string) => Promise<Pipe>;

export interface LocalProviderOptions {
  /** Sentiment model id. Defaults to a distilled SST-2 model. */
  sentimentModel?: string;
  /** Sentence-embedding model id, used by `embed`. Defaults to all-MiniLM-L6-v2. */
  embeddingModel?: string;
  /** Override how pipelines are created — mainly for testing without downloading models. */
  createPipeline?: PipelineFactory;
}

const DEFAULT_SENTIMENT_MODEL = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * On-device sentiment and embedding provider backed by transformers.js
 * (Tier 0 — no API key, no network once models are cached locally).
 *
 * `@xenova/transformers` is an **optional** dependency loaded lazily via dynamic
 * `import()` only when a model is first needed, so installing this package adds
 * no ML weight until you actually run it. Each model pipeline is created once
 * and reused across calls. The SST-2 model is binary, so `classifySentiment`
 * returns `positive`/`negative` (never `neutral`) except for empty input, which
 * returns a no-signal neutral without loading a model.
 *
 * @example
 * ```ts
 * // requires: pnpm add @xenova/transformers
 * const result = await new Pipeline()
 *   .source(new CsvAdapter())
 *   .provider(new LocalProvider())
 *   .run(csvText);
 * ```
 */
export class LocalProvider implements AnalysisProvider {
  readonly name = 'local';

  readonly capabilities: ProviderCapabilities = {
    sentiment: true,
    embeddings: true,
    summarization: false,
    customPrompts: false,
  };

  private readonly sentimentModel: string;
  private readonly embeddingModel: string;
  private readonly createPipeline: PipelineFactory;

  private sentimentPipe?: Promise<Pipe>;
  private embeddingPipe?: Promise<Pipe>;

  constructor(options: LocalProviderOptions = {}) {
    this.sentimentModel = options.sentimentModel ?? DEFAULT_SENTIMENT_MODEL;
    this.embeddingModel = options.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    this.createPipeline = options.createPipeline ?? defaultPipelineFactory;
  }

  async classifySentiment(review: NormalizedReview): Promise<SentimentResult> {
    if (review.text.trim() === '') return { score: 0, label: 'neutral', confidence: 0 };

    const pipe = await this.getSentimentPipe();
    const prediction = firstPrediction(await pipe(review.text));
    const positive = prediction.label.toUpperCase() === 'POSITIVE';
    return {
      score: positive ? prediction.score : -prediction.score,
      label: positive ? 'positive' : 'negative',
      confidence: prediction.score,
    };
  }

  async embed(review: NormalizedReview): Promise<number[]> {
    const pipe = await this.getEmbeddingPipe();
    const output = await pipe(review.text, { pooling: 'mean', normalize: true });
    return toVector(output);
  }

  private getSentimentPipe(): Promise<Pipe> {
    this.sentimentPipe ??= this.createPipeline('sentiment-analysis', this.sentimentModel);
    return this.sentimentPipe;
  }

  private getEmbeddingPipe(): Promise<Pipe> {
    this.embeddingPipe ??= this.createPipeline('feature-extraction', this.embeddingModel);
    return this.embeddingPipe;
  }
}

interface TransformersModule {
  pipeline: (task: string, model: string) => Promise<Pipe>;
}

const defaultPipelineFactory: PipelineFactory = async (task, model) => {
  // Non-literal specifier so the optional dependency is resolved at runtime, not
  // by the type checker — this package must typecheck with it uninstalled.
  const specifier: string = '@xenova/transformers';
  let transformers: TransformersModule;
  try {
    transformers = (await import(specifier)) as unknown as TransformersModule;
  } catch (error) {
    throw new Error(
      'LocalProvider requires the optional dependency "@xenova/transformers", which is not ' +
        'installed. Add it where you use LocalProvider (e.g. `pnpm add @xenova/transformers`). ' +
        `Underlying error: ${errorMessage(error)}`,
    );
  }
  return transformers.pipeline(task, model);
};

interface SentimentPrediction {
  label: string;
  score: number;
}

function firstPrediction(raw: unknown): SentimentPrediction {
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (item && typeof item === 'object' && 'label' in item && 'score' in item) {
    const { label, score } = item as { label: unknown; score: unknown };
    if (typeof label === 'string' && typeof score === 'number') return { label, score };
  }
  throw new Error('LocalProvider: unexpected sentiment output shape from the model');
}

function toVector(output: unknown): number[] {
  if (output && typeof output === 'object') {
    const { data, tolist } = output as {
      data?: ArrayLike<number>;
      tolist?: () => unknown;
    };
    if (data && typeof data.length === 'number') return Array.from(data);
    if (typeof tolist === 'function') {
      const list = tolist();
      if (Array.isArray(list))
        return (Array.isArray(list[0]) ? list[0] : list) as number[];
    }
  }
  throw new Error('LocalProvider: unexpected embedding output shape from the model');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
