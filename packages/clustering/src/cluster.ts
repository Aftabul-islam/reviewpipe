import { kmeans } from 'ml-kmeans';
import type { ThemeItem } from '@reviewpipe/core';

/**
 * Group items by k-means over their embedding vectors. `seed` makes the
 * initialization deterministic. Empty resulting clusters are dropped, so the
 * returned count may be less than `k`.
 */
export function groupByEmbeddings(
  items: ThemeItem[],
  k: number,
  seed: number,
): ThemeItem[][] {
  if (k <= 1 || items.length <= 1) return [items];

  const vectors = items.map((item) => item.embedding ?? []);
  const { clusters } = kmeans(vectors, k, { seed, initialization: 'kmeans++' });

  const groups: ThemeItem[][] = Array.from({ length: k }, () => []);
  clusters.forEach((cluster, index) => {
    const item = items[index];
    const bucket = groups[cluster];
    if (item && bucket) bucket.push(item);
  });
  return groups.filter((group) => group.length > 0);
}
