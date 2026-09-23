#!/usr/bin/env bash
# Downloads real-world review datasets into data/raw/ for manual testing,
# clustering tuning, and benchmarking.
#
# Never used in CI (slow, network-dependent, licensing varies).
# Safe to re-run: skips files that already exist.

set -euo pipefail

RAW_DIR="$(dirname "$0")/../data/raw"
mkdir -p "$RAW_DIR"

echo "== reviewpipe: downloading real datasets into $RAW_DIR =="

# --- Women's E-Commerce Clothing Reviews (Kaggle) ---
# Closest to the actual target use case: product reviews with rating + text.
# Requires Kaggle CLI + credentials (~/.kaggle/kaggle.json). See:
# https://github.com/Kaggle/kaggle-api#api-credentials
CLOTHING_CSV="$RAW_DIR/womens_ecommerce_clothing_reviews.csv"
if [ -f "$CLOTHING_CSV" ]; then
  echo "-- Clothing reviews already present, skipping"
else
  if command -v kaggle >/dev/null 2>&1; then
    echo "-- Downloading Women's E-Commerce Clothing Reviews via Kaggle CLI..."
    kaggle datasets download -d nicapotato/womens-ecommerce-clothing-reviews \
      -p "$RAW_DIR" --unzip
    # Kaggle's zip contains a differently-named CSV; normalize the name.
    find "$RAW_DIR" -maxdepth 1 -iname "*clothing*review*.csv" \
      -exec mv {} "$CLOTHING_CSV" \;
  else
    echo "-- Kaggle CLI not found. Install with: pip install kaggle"
    echo "   Then set up credentials and re-run this script."
  fi
fi

# --- Amazon Reviews 2023 (Hugging Face, subset) ---
# Standard reference dataset for the benchmark suite.
# Requires the `datasets` Python package OR the huggingface-cli.
AMAZON_DIR="$RAW_DIR/amazon_reviews_2023"
if [ -d "$AMAZON_DIR" ] && [ "$(ls -A "$AMAZON_DIR" 2>/dev/null)" ]; then
  echo "-- Amazon Reviews subset already present, skipping"
else
  mkdir -p "$AMAZON_DIR"
  if command -v huggingface-cli >/dev/null 2>&1; then
    echo "-- Downloading Amazon-Reviews-2023 (Electronics, subset) via huggingface-cli..."
    huggingface-cli download McAuley-Lab/Amazon-Reviews-2023 \
      --repo-type dataset \
      --include "raw/review_categories/Electronics.jsonl*" \
      --local-dir "$AMAZON_DIR"
    echo "-- NOTE: this repo's files can be large. Trim to ~10k rows manually"
    echo "   with e.g. \`head -n 10000\` if you only need a working subset."
  else
    echo "-- huggingface-cli not found. Install with: pip install huggingface_hub"
    echo "   Then re-run this script."
  fi
fi

echo ""
echo "== Summary =="
for f in "$RAW_DIR"/*; do
  if [ -f "$f" ]; then
    printf "%-50s %s\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"
  elif [ -d "$f" ]; then
    printf "%-50s %s\n" "$(basename "$f")/" "$(du -sh "$f" | cut -f1)"
  fi
done
echo ""
echo "Done. These files are gitignored — re-run this script on any new machine."
