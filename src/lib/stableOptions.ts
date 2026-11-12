// Deterministic helpers: generated answer options must keep the same order and indices after a refresh.
export function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  return items
    .map((item, index) => ({ item, index, rank: hashText(`${seed}:${String(item)}`) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}
