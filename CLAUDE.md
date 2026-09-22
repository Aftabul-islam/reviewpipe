# reviewpipe

A pipeline framework for analyzing e-commerce customer reviews (sentiment, themes,
trends). Point it at raw reviews, get structured insight out.

## Build plan
This repo follows a phased build plan in `docs/DEV_GUIDE.md` (gitignored,
local-only — read it at the start of each session to know the current phase
and what's already done). Update the phase checklist in that file as work
completes. If `docs/DEV_GUIDE.md` is missing from this checkout, ask the user
for it before proceeding — do not guess the architecture from scratch.

## Architecture
Monorepo, pnpm workspaces. Core package has zero ML dependencies. Everything
model- or format-specific is its own installable package.

- `packages/core` — schema, interfaces (SourceAdapter, Transformer,
  AnalysisProvider, Exporter), the Pipeline engine, aggregation logic.
  No ML deps, ever.
- `packages/adapter-*` — turn raw input (CSV, JSON, platform exports) into
  `NormalizedReview[]`.
- `packages/provider-*` — turn normalized reviews into sentiment/themes/
  summaries. Four tiers: lexicon (no deps), local (transformers.js, lazy-
  loaded), huggingface (hosted API), openai/anthropic (frontier, BYO key).
  All implement the same `AnalysisProvider` interface with a `capabilities`
  flag so core can degrade gracefully.
- `packages/exporter-*` — turn an `AnalysisResult` into JSON/CSV/HTML output.
- `examples/` — runnable reference integrations (Node batch script, Express
  route). Keep these working against the current API at all times.

## Test data
- `data/fixtures/` — committed, small (~25 rows), deterministic. Used by
  ALL automated tests and CI. Never write a test that depends on
  `data/raw/` being present.
- `data/raw/` — gitignored, real public datasets (Amazon Reviews, Yelp,
  Kaggle e-commerce clothing reviews), downloaded via
  `scripts/download-datasets.sh`. Used only for manual testing, clustering
  tuning (Phase 7), and the benchmark suite (Phase 11). Never referenced
  in CI.

## Conventions
- TypeScript strict mode, no `any`.
- Every package is independently installable — check that installing
  `packages/core` alone never pulls in an ML dependency.
- Provider calls must fail per-item, not per-batch: one bad review must
  never crash the whole pipeline run. Collect errors into `result.errors[]`.
- Commit after each dev-guide phase checkpoint, not mid-phase.

## Code quality standard — this is a public library, treat it like one

This package will be read by strangers deciding whether to trust it with
their data pipeline. Code quality and doc quality are both non-negotiable,
but they are NOT the same thing as "comment everything." Over-commented
code reads as unreviewed/AI-generated and actively hurts credibility.
Follow these rules exactly, don't default to more-is-safer.

**Documentation — public API only, and only what isn't obvious from the signature**
- TSDoc goes on every *exported* type, class, and function — nothing
  internal/private gets a doc comment unless its behavior is genuinely
  non-obvious.
- A TSDoc comment explains intent, constraints, and edge cases the
  signature can't express (what happens on empty input, what units a
  number is in, what a provider does when a capability is missing). It
  never just restates the function name in sentence form.
- One `@example` on the main public entry points (`Pipeline`, each
  provider constructor) is worth more than a paragraph of prose.
- Bad: `/** Gets the sentiment score */ function getSentiment(text: string)`
  — this says nothing the signature didn't already say.
- Good: `/** Scores sentiment in [-1, 1]. Empty or whitespace-only input
  returns 0 with a low-confidence flag rather than throwing. */`

**Inline comments — why, never what**
- A comment justifies a non-obvious decision ("HF free tier caps at 30
  req/min, hence the 2s backoff") — it never narrates what the next line
  literally does ("// loop through reviews", "// increment counter").
  If code needs a comment to say *what* it does, rewrite the code to be
  self-evident (better names, extracted function) instead of commenting it.
- No comment-shaped changelog in the code ("// added this on Jan 5",
  "// fixed bug here") — that's what git history and commit messages are
  for, not the source file.
- No restating types in comments ("// this is an array of reviews") —
  TypeScript already says that; a comment repeating it is noise a reader
  has to read past to find the comments that actually matter.
- Delete commented-out code before committing — it belongs in git history,
  never in the file.

**Structure and shape**
- Small, single-responsibility functions and files over large ones —
  if a file needs a table of contents in your head to navigate, split it.
- Prefer clear names over comments as the primary form of documentation.
  `filterLowConfidenceReviews()` needs no comment; `filter()` needs one
  because it needed a better name instead.
- Keep the public export surface intentional and minimal — export what
  consumers need, not every internal helper. A cluttered `index.ts` with
  40 exports is itself a form of mess, even with zero comments.
- Consistent formatting is enforced by prettier/eslint (already
  configured at the root) — run `pnpm -w lint` before considering any
  phase done, don't rely on manual formatting judgment.
- No debug leftovers: no stray `console.log`, no `TODO` without a linked
  issue or a genuine near-term follow-up, no dead/unreachable branches.

**When in doubt**
Read the file back as if you're a stranger deciding whether to trust this
library. If the comment density makes it look over-explained or
unreviewed, cut comments, not code. If the logic itself is hard to follow
even with zero comments, that's a signal to restructure the code, not to
add more prose around it.

## Commands
- `pnpm install` — install all workspace deps
- `pnpm -w test` — run all tests (fixtures only, no network)
- `pnpm -w typecheck` — typecheck all packages
- `pnpm -w lint` — lint all packages
- `pnpm data:download` — pull real datasets into `data/raw/` (manual use only)
- `pnpm benchmark` — run the Phase 11 benchmark suite against `data/raw/`

## Current status
Phase 1 done — `packages/core` holds the schema, the four interfaces, and the
`AnalysisResult` type (types only, no engine yet). Next: Phase 2, the pipeline
engine + aggregation. See `docs/DEV_GUIDE.md`.
