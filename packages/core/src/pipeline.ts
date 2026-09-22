import type { NormalizedReview } from './schema.js';
import type {
  SourceAdapter,
  Transformer,
  AnalysisProvider,
  Exporter,
  ExporterOutput,
} from './interfaces.js';
import type { AnalysisResult, PipelineError } from './result.js';
import { SCHEMA_VERSION } from './result.js';
import { aggregate, type ClassifiedReview } from './aggregate.js';

/**
 * Wires an input adapter, optional transform steps, an analysis provider, and
 * an optional exporter into a single runnable flow:
 * `adapter → transformers → provider → aggregation → exporter`.
 *
 * The stages are set with chainable builder methods; {@link Pipeline.run}
 * executes them. Sentiment classification fails per review — one review that
 * throws is recorded in {@link AnalysisResult.errors} and the run continues.
 * The provider's {@link AnalysisProvider.capabilities} decide which stages run:
 * a provider without summarization simply produces no summary.
 *
 * @example
 * ```ts
 * const result = await new Pipeline()
 *   .source(new CsvAdapter())
 *   .provider(new LexiconProvider())
 *   .run(csvText);
 * // result is an AnalysisResult; add .export(...) to get serialized output instead.
 * ```
 */
export class Pipeline {
  private adapter?: SourceAdapter;
  private readonly transformers: Transformer[] = [];
  private analysisProvider?: AnalysisProvider;
  private exporter?: Exporter;

  /** Set the input adapter. Required before {@link Pipeline.run}. */
  source(adapter: SourceAdapter): this {
    this.adapter = adapter;
    return this;
  }

  /** Add a transform step. Steps run in the order added; may be called repeatedly. */
  use(transformer: Transformer): this {
    this.transformers.push(transformer);
    return this;
  }

  /** Set the analysis provider. Required before {@link Pipeline.run}. */
  provider(provider: AnalysisProvider): this {
    this.analysisProvider = provider;
    return this;
  }

  /** Set the output exporter. Optional — without one, {@link Pipeline.run} returns the raw result. */
  export(exporter: Exporter): this {
    this.exporter = exporter;
    return this;
  }

  /**
   * Run the pipeline against `input`, which is passed verbatim to the adapter.
   *
   * Returns the {@link AnalysisResult} when no exporter is set, otherwise the
   * exporter's serialized output. A failing adapter or transformer is fatal
   * and throws, since neither leaves anything meaningful to analyze; provider
   * failures are per-review and non-fatal.
   */
  async run(input: unknown): Promise<AnalysisResult | ExporterOutput> {
    const provider = this.requireProvider();
    const errors: PipelineError[] = [];

    const reviews = await this.load(input);
    const classified = await this.classify(reviews, provider, errors);
    const summary = await this.summarize(reviews, provider, errors);

    const result: AnalysisResult = {
      schemaVersion: SCHEMA_VERSION,
      ...aggregate(classified),
      ...(summary !== undefined ? { summary } : {}),
      errors,
    };

    return this.exporter ? this.exporter.export(result) : result;
  }

  private requireProvider(): AnalysisProvider {
    if (!this.analysisProvider) {
      throw new Error('Pipeline.run: no provider set — call .provider(...) first');
    }
    return this.analysisProvider;
  }

  private async load(input: unknown): Promise<NormalizedReview[]> {
    if (!this.adapter) {
      throw new Error('Pipeline.run: no source adapter set — call .source(...) first');
    }
    let reviews = await this.adapter.parse(input);
    for (const transformer of this.transformers) {
      reviews = await transformer.transform(reviews);
    }
    return reviews;
  }

  private async classify(
    reviews: NormalizedReview[],
    provider: AnalysisProvider,
    errors: PipelineError[],
  ): Promise<ClassifiedReview[]> {
    if (!provider.capabilities.sentiment || !provider.classifySentiment) return [];

    const classified: ClassifiedReview[] = [];
    for (const review of reviews) {
      try {
        const sentiment = await provider.classifySentiment(review);
        classified.push({ review, sentiment });
      } catch (err) {
        errors.push({
          stage: 'provider',
          reviewId: review.id,
          message: errorMessage(err),
        });
      }
    }
    return classified;
  }

  private async summarize(
    reviews: NormalizedReview[],
    provider: AnalysisProvider,
    errors: PipelineError[],
  ): Promise<string | undefined> {
    if (!provider.capabilities.summarization || !provider.summarize) return undefined;

    try {
      return await provider.summarize(reviews);
    } catch (err) {
      errors.push({
        stage: 'provider',
        message: `summarization failed: ${errorMessage(err)}`,
      });
      return undefined;
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
