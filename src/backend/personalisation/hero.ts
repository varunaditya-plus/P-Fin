import { RankedCandidate, qualityConfidence } from "./engine";
import { TasteCandidate } from "./types";

/** The caller supplies eligible candidates from one source only. No extra fetch
 * or external-library substitution is needed to vary the banner. */
export function recommendationHero<T extends TasteCandidate>(
  ranked: RankedCandidate<T>[],
  others: RankedCandidate<T>[] = [],
  random: () => number = Math.random,
): T[] {
  const result: T[] = [];
  const used = new Set<string>();
  const add = (candidate?: T) => {
    if (!candidate || used.has(candidate.media.key)) return;
    used.add(candidate.media.key);
    result.push(candidate);
  };
  ranked.slice(0, 2).forEach((entry) => add(entry.candidate));
  add(others[0]?.candidate);
  const popular = [...ranked, ...others]
    .map((entry) => entry.candidate)
    .sort(
      (a, b) =>
        (b.popularity ?? qualityConfidence(b.quality, b.voteCount)) -
        (a.popularity ?? qualityConfidence(a.quality, a.voteCount)),
    );
  add(popular.find((candidate) => !used.has(candidate.media.key)));
  const pool = popular
    .filter((candidate) => !used.has(candidate.media.key))
    .slice(0, 30);
  while (pool.length && result.length < 6) {
    const index = Math.min(
      pool.length - 1,
      Math.max(0, Math.floor(random() * pool.length)),
    );
    add(pool.splice(index, 1)[0]);
  }
  return result;
}
