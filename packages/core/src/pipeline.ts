import type { NormalizedReview } from './schema.js';
import type {
  SourceAdapter,
  Transformer,
  AnalysisProvider,
  Exporter,
  ExporterOutput,
  ThemeExtractor,
  ThemeItem,
} from './interfaces.js';
import type { AnalysisResult, PipelineError, Theme } from './result.js';
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
  private themeExtractor?: ThemeExtractor;
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

  /**
   * Set the theme extractor. Optional — without one, `result.themes` is empty.
   * The pipeline supplies it each review's sentiment score plus, when the
   * provider supports `embed`, an embedding vector.
   */
  themes(extractor: ThemeExtractor): this {
    this.themeExtractor = extractor;
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
    const themes = await this.extractThemes(reviews, classified, provider, errors);

    const result: AnalysisResult = {
      schemaVersion: SCHEMA_VERSION,
      ...aggregate(classified),
      themes,
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

  private async extractThemes(
    reviews: NormalizedReview[],
    classified: ClassifiedReview[],
    provider: AnalysisProvider,
    errors: PipelineError[],
  ): Promise<Theme[]> {
    const extractor = this.themeExtractor;
    if (!extractor) return [];

    const items = await this.buildThemeItems(reviews, classified, provider, errors);
    try {
      return await extractor.extract(items);
    } catch (err) {
      errors.push({
        stage: 'themes',
        message: `theme extraction failed: ${errorMessage(err)}`,
      });
      return [];
    }
  }

  private async buildThemeItems(
    reviews: NormalizedReview[],
    classified: ClassifiedReview[],
    provider: AnalysisProvider,
    errors: PipelineError[],
  ): Promise<ThemeItem[]> {
    const sentimentById = new Map(
      classified.map((c) => [c.review.id, c.sentiment.score]),
    );
    const embed =
      provider.capabilities.embeddings && provider.embed
        ? provider.embed.bind(provider)
        : undefined;

    const items: ThemeItem[] = [];
    for (const review of reviews) {
      const item: ThemeItem = { review };
      const sentiment = sentimentById.get(review.id);
      if (sentiment !== undefined) item.sentiment = sentiment;
      if (embed) {
        try {
          item.embedding = await embed(review);
        } catch (err) {
          errors.push({
            stage: 'provider',
            reviewId: review.id,
            message: `embedding failed: ${errorMessage(err)}`,
          });
        }
      }
      items.push(item);
    }
    return items;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
