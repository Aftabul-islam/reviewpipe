export { Pipeline } from './pipeline.js';

export type { NormalizedReview } from './schema.js';

export type {
  Awaitable,
  SourceAdapter,
  Transformer,
  ProviderCapabilities,
  SentimentResult,
  AnalysisProvider,
  Exporter,
  ExporterOutput,
  ThemeItem,
  ThemeExtractor,
} from './interfaces.js';

export { SCHEMA_VERSION } from './result.js';
export type {
  SentimentLabel,
  OverallSentiment,
  Theme,
  TrendPoint,
  FlaggedReview,
  PipelineStage,
  PipelineError,
  AnalysisResult,
} from './result.js';
