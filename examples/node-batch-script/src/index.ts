import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pipeline, type AnalysisResult } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { ClusteringThemeExtractor } from '@reviewpipe/clustering';
import { JsonExporter } from '@reviewpipe/exporter-json';
import { HtmlExporter } from '@reviewpipe/exporter-html';

const inputPath = fileURLToPath(new URL('../reviews.csv', import.meta.url));
const outDir = fileURLToPath(new URL('../out/', import.meta.url));

async function main(): Promise<void> {
  const csv = readFileSync(inputPath, 'utf8');

  // Tier -1 (lexicon): zero dependencies, no network, no API key. To use the
  // on-device model instead, `pnpm add @xenova/transformers` and swap in
  // `new LocalProvider()` from `@reviewpipe/provider-local`.
  const result = (await new Pipeline()
    .source(new CsvAdapter())
    .provider(new LexiconProvider())
    .themes(new ClusteringThemeExtractor({ k: 3 }))
    .run(csv)) as AnalysisResult;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}report.json`, new JsonExporter().export(result));
  writeFileSync(
    `${outDir}report.html`,
    new HtmlExporter({ title: 'Reviews report' }).export(result),
  );

  const { positive, neutral, negative, reviewCount } = result.overallSentiment;
  process.stdout.write(
    `Analyzed ${reviewCount} reviews ` +
      `(${positive} positive, ${neutral} neutral, ${negative} negative).\n` +
      `Wrote ${outDir}report.json and ${outDir}report.html\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
