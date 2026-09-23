import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AnalysisProvider, SentimentLabel } from '@reviewpipe/core';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';
import { LocalProvider } from '@reviewpipe/provider-local';
import { parseLabeledCsv } from './dataset.js';
import { computeMetrics, LABELS, type BenchmarkMetrics } from './metrics.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_DATASET = `${REPO_ROOT}data/fixtures/labeled-sentiment.csv`;
const OUTPUT = `${REPO_ROOT}BENCHMARKS.md`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ?? DEFAULT_DATASET;
  const provider = makeProvider(args.provider);

  const rows = parseLabeledCsv(readFileSync(datasetPath, 'utf8'));
  if (rows.length === 0)
    throw new Error(`benchmarks: no labeled rows found in ${datasetPath}`);
  if (!provider.classifySentiment) {
    throw new Error(`benchmarks: provider "${provider.name}" does not support sentiment`);
  }

  const pairs: { gold: SentimentLabel; predicted: SentimentLabel }[] = [];
  for (const row of rows) {
    const result = await provider.classifySentiment({
      id: row.id,
      text: row.text,
      source: 'benchmark',
    });
    pairs.push({ gold: row.label, predicted: result.label });
  }

  const metrics = computeMetrics(pairs);
  const datasetName = datasetPath.startsWith(REPO_ROOT)
    ? datasetPath.slice(REPO_ROOT.length)
    : datasetPath;
  writeFileSync(OUTPUT, renderMarkdown(datasetName, provider.name, metrics));

  process.stdout.write(
    `${provider.name}: accuracy ${fmt(metrics.accuracy)}, macro-F1 ${fmt(metrics.macroF1)} ` +
      `(n=${metrics.total}) → wrote BENCHMARKS.md\n`,
  );
}

interface Args {
  dataset?: string;
  provider?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dataset') args.dataset = argv[++i];
    else if (argv[i] === '--provider') args.provider = argv[++i];
  }
  return args;
}

function makeProvider(name: string | undefined): AnalysisProvider {
  if (name === 'local') return new LocalProvider();
  if (name === undefined || name === 'lexicon') return new LexiconProvider();
  throw new Error(
    `benchmarks: unknown provider "${name}" (expected "lexicon" or "local")`,
  );
}

function renderMarkdown(
  dataset: string,
  provider: string,
  metrics: BenchmarkMetrics,
): string {
  const row = (label: string, pick: (l: SentimentLabel) => number): string =>
    `| ${label} | ${LABELS.map((l) => fmt(pick(l))).join(' | ')} |`;

  return `# Benchmarks

Sentiment-classification metrics on \`${dataset}\` (${metrics.total} labeled reviews).
Regenerate with \`pnpm benchmark\` (optionally \`pnpm benchmark --dataset <path> --provider <lexicon|local>\`).

## ${provider}

- **Accuracy:** ${fmt(metrics.accuracy)}
- **Macro-F1:** ${fmt(metrics.macroF1)}

| Metric | ${LABELS.join(' | ')} |
| --- | ${LABELS.map(() => '---').join(' | ')} |
${row('Precision', (l) => metrics.perClass[l].precision)}
${row('Recall', (l) => metrics.perClass[l].recall)}
${row('F1', (l) => metrics.perClass[l].f1)}
| Support | ${LABELS.map((l) => metrics.perClass[l].support).join(' | ')} |
`;
}

function fmt(value: number): string {
  return value.toFixed(3);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
