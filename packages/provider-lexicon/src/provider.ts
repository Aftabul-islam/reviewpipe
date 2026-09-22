import type {
  AnalysisProvider,
  NormalizedReview,
  ProviderCapabilities,
  SentimentResult,
} from '@reviewpipe/core';
import { scoreSentiment } from './sentiment.js';

/**
 * Sentiment provider backed by a bundled AFINN word list — the zero-dependency,
 * no-network baseline tier. It classifies sentiment only; it produces no
 * embeddings or summaries, so a pipeline using it gets sentiment, trend, and
 * flagged reviews but no clustering or narrative summary.
 *
 * @example
 * ```ts
 * const result = await new Pipeline()
 *   .source(new CsvAdapter())
 *   .provider(new LexiconProvider())
 *   .run(csvText);
 * ```
 */
export class LexiconProvider implements AnalysisProvider {
  readonly name = 'lexicon';

  readonly capabilities: ProviderCapabilities = {
    sentiment: true,
    embeddings: false,
    summarization: false,
    customPrompts: false,
  };

  classifySentiment(review: NormalizedReview): SentimentResult {
    return scoreSentiment(review.text);
  }
}
