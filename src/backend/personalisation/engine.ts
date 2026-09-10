import {
  FRANCHISES,
  MOODS,
  TasteCandidate,
  TasteMedia,
  TasteProfile,
  TasteRating,
  TasteType,
} from "./types";

const weights: Record<TasteRating, number> = {
  loved: 1.75,
  liked: 1,
  okay: 0.25,
  disliked: -1.25,
  hated: -2.25,
};
const DAY = 86400000;
export function ratingRecency(ratedAt: number, now = Date.now()) {
  return 1 / (1 + Math.max(0, (now - ratedAt) / DAY) / 90);
}
export function buildTasteAffinities(
  profile: TasteProfile,
  type: TasteType,
  candidates: TasteCandidate[] = [],
  now = Date.now(),
) {
  const genres = new Map<string, number>();
  const studios = new Map<string, number>();
  const add = (media: TasteMedia, weight: number) => {
    if (media.type !== type) return;
    media.genres.forEach((genre) =>
      genres.set(genre, (genres.get(genre) ?? 0) + weight),
    );
    media.studios.forEach((studio) =>
      studios.set(
        studio.toLowerCase(),
        (studios.get(studio.toLowerCase()) ?? 0) + weight * 0.35,
      ),
    );
  };
  Object.values(profile.ratings).forEach((rating) =>
    add(rating, weights[rating.rating] * ratingRecency(rating.ratedAt, now)),
  );
  candidates.forEach((candidate) => {
    if (profile.ratings[candidate.media.key]) return;
    const weight = Math.max(
      candidate.favourite ? 0.9 : 0,
      candidate.watched
        ? 0.6 * ratingRecency(candidate.lastPlayedAt ?? now - 90 * DAY, now)
        : 0,
      candidate.progress ? 0.45 : 0,
    );
    if (weight) add(candidate.media, weight);
  });
  profile.preferences.favoriteGenres.forEach((genre) =>
    genres.set(genre, (genres.get(genre) ?? 0) + 0.75),
  );
  MOODS.filter((mood) => profile.preferences.moods.includes(mood.id)).forEach(
    (mood) =>
      mood.genres.forEach((genre) =>
        genres.set(genre, (genres.get(genre) ?? 0) + 0.5),
      ),
  );
  return { genres, studios };
}
export function hasTasteSignals(
  profile: TasteProfile,
  candidates: TasteCandidate[] = [],
) {
  return Boolean(
    Object.keys(profile.ratings).length ||
      profile.preferences.favoriteGenres.length ||
      profile.preferences.moods.length ||
      profile.preferences.franchises.length ||
      candidates.some(
        (item) => item.watched || item.favourite || item.progress,
      ),
  );
}
export function franchiseMatches(media: TasteMedia, franchiseId: string) {
  const franchise = FRANCHISES.find((item) => item.id === franchiseId);
  const text = [media.title, ...media.studios].join(" ").toLowerCase();
  return Boolean(franchise?.patterns.some((pattern) => text.includes(pattern)));
}
export function qualityConfidence(input: number | undefined, votes?: number) {
  const rating = input ?? 6.5;
  const quality = Number.isFinite(rating)
    ? Math.min(10, Math.max(0, rating))
    : 6.5;
  // Jellyfin often has no vote count: use a weak signal instead of inventing confidence.
  const reliability =
    votes === undefined ? 0.25 : Math.max(0, votes) / (Math.max(0, votes) + 50);
  return 6.5 + reliability * (quality - 6.5);
}
export interface RankedCandidate<T extends TasteCandidate> {
  candidate: T;
  score: number;
  reason: string;
  seed: string;
}
export function rankRecommendations<T extends TasteCandidate>(
  candidates: T[],
  profile: TasteProfile,
  type: TasteType,
  now = Date.now(),
  activity: TasteCandidate[] = candidates,
): RankedCandidate<T>[] {
  const affinities = buildTasteAffinities(profile, type, activity, now);
  const seen = new Set<string>();
  const ranked = candidates
    .flatMap((candidate) => {
      const { media } = candidate;
      if (
        media.type !== type ||
        seen.has(media.key) ||
        profile.ratings[media.key] ||
        candidate.watched ||
        candidate.progress
      )
        return [];
      seen.add(media.key);
      const genres = [...media.genres].sort(
        (a, b) =>
          (affinities.genres.get(b) ?? 0) - (affinities.genres.get(a) ?? 0),
      );
      const genreScore =
        genres.reduce(
          (sum, genre) =>
            sum + Math.tanh((affinities.genres.get(genre) ?? 0) / 3) * 3,
          0,
        ) / Math.sqrt(Math.max(1, genres.length));
      const studioScore = media.studios.reduce(
        (sum, studio) =>
          sum + Math.tanh(affinities.studios.get(studio.toLowerCase()) ?? 0),
        0,
      );
      const franchise = profile.preferences.franchises.find((id) =>
        franchiseMatches(media, id),
      );
      if (
        franchise &&
        candidate.voteCount !== undefined &&
        candidate.voteCount < 50
      )
        return [];
      const reliableFranchise =
        franchise &&
        (candidate.voteCount === undefined || candidate.voteCount >= 50);
      const related = [...(candidate.relatedSeeds ?? [])].sort(
        (a, b) => b.weight - a.weight,
      );
      const sourceScore = related.reduce(
        (sum, seed, index) => sum + seed.weight * (index ? 0.5 : 1),
        0,
      );
      const score =
        sourceScore +
        genreScore * 2 +
        studioScore * 0.6 +
        (reliableFranchise ? 2 : 0) +
        (qualityConfidence(candidate.quality, candidate.voteCount) - 6.5) *
          0.4 +
        Math.log10(1 + Math.max(0, candidate.popularity ?? 0)) * 0.1 +
        (candidate.favourite ? 0.5 : 0);
      return [
        {
          candidate,
          score,
          seed:
            related[0]?.key ??
            (reliableFranchise
              ? `franchise:${franchise}`
              : (genres[0] ?? "discovery")),
          reason: reliableFranchise
            ? `From your ${FRANCHISES.find((item) => item.id === franchise)?.label} preference`
            : genreScore > 0 && genres[0]
              ? `Matches your taste in ${genres[0].toLowerCase()}`
              : "Something different to explore",
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.media.key.localeCompare(b.candidate.media.key),
    );
  const counts = new Map<string, number>();
  const picked: RankedCandidate<T>[] = [];
  const overflow: RankedCandidate<T>[] = [];
  ranked.forEach((item) => {
    const count = counts.get(item.seed) ?? 0;
    if (count < 3) {
      picked.push(item);
      counts.set(item.seed, count + 1);
    } else overflow.push(item);
  });
  return [...picked, ...overflow].slice(0, 60);
}
export function contentIntensity(media: TasteMedia) {
  if (
    media.genres.some((genre) =>
      ["War", "History", "Drama", "Crime", "Documentary"].includes(genre),
    )
  )
    return "heavy";
  if (
    media.genres.some((genre) =>
      ["Animation", "Family", "Comedy", "Music"].includes(genre),
    )
  )
    return "light";
  return "balanced";
}
export interface RecommendationRow<T extends TasteCandidate> {
  id: string;
  title: string;
  description: string;
  items: T[];
}
export function recommendationRows<T extends TasteCandidate>(
  ranked: RankedCandidate<T>[],
): RecommendationRow<T>[] {
  const size = Math.max(1, Math.ceil(ranked.length / 3));
  const tiers = ["Sure Bets", "Worth a Look", "Something New"].map(
    (title, index) => ({
      id: `tier-${index}`,
      title,
      description:
        "Relative matches based on your ratings and library activity.",
      items: ranked
        .slice(index * size, (index + 1) * size)
        .map((entry) => entry.candidate),
    }),
  );
  const moods = [
    ["light", "Easy Watching"],
    ["balanced", "Balanced Picks"],
    ["heavy", "Heavy Hitters"],
  ].map(([id, title]) => {
    const pool = ranked.filter(
      (entry) => contentIntensity(entry.candidate.media) === id,
    );
    // Interleave lower-ranked discoveries with favourites to vary each mood row.
    const items = pool.flatMap((entry, index) =>
      index % 3 === 0 && pool.length > 6
        ? [entry, pool[pool.length - 1 - Math.floor(index / 3)]]
        : [entry],
    );
    return {
      id: `mood-${id}`,
      title,
      description: "A genre-based guide to mood and intensity.",
      items: [
        ...new Map(
          items.map((entry) => [entry.candidate.media.key, entry.candidate]),
        ).values(),
      ].slice(0, 20),
    };
  });
  return [...tiers, ...moods].filter((row) => row.items.length);
}
export function nextQuizBatch<T extends TasteCandidate>(
  candidates: T[],
  profile: TasteProfile,
  type: TasteType,
  seen: Set<string>,
  random = Math.random,
) {
  const eligible = candidates.filter(
    (item) =>
      item.media.type === type &&
      !seen.has(item.media.key) &&
      !profile.ratings[item.media.key],
  );
  const ranked = rankRecommendations(
    eligible.map((item) => ({ ...item, watched: false, progress: false })),
    profile,
    type,
  ).map((entry) => entry.candidate);
  const shuffled = eligible
    .map((item) => ({ item, order: random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
  return [
    ...new Map(
      [...ranked.slice(0, 5), ...shuffled].map((item) => [
        item.media.key,
        item,
      ]),
    ).values(),
  ].slice(0, 10);
}
