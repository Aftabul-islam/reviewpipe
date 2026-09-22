import type { AnalysisResult, Exporter } from '@reviewpipe/core';

export interface JsonExporterOptions {
  /** Spaces of indentation. `0` produces compact single-line JSON. Defaults to `2`. */
  indent?: number;
}

/**
 * Serializes an {@link AnalysisResult} to JSON — the lossless, full-fidelity
 * output format. Pretty-printed by default; pass `{ indent: 0 }` for compact
 * output. `undefined` fields (e.g. an absent `summary`) are omitted, per
 * standard JSON semantics.
 *
 * @example
 * ```ts
 * const json = new JsonExporter().export(result);
 * ```
 */
export class JsonExporter implements Exporter {
  constructor(private readonly options: JsonExporterOptions = {}) {}

  export(result: AnalysisResult): string {
    return JSON.stringify(result, null, this.options.indent ?? 2);
  }
}
