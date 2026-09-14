import { useEffect, useMemo, useState } from "react";

import {
  LibraryTasteCandidate,
  SeerrTasteCandidate,
  addLibraryRelatedSeeds,
  getSeerrTasteCandidates,
  getTasteLibrary,
  seerrTasteEnabled,
} from "@/backend/personalisation/catalog";
import {
  RankedCandidate,
  RecommendationRow,
  hasTasteSignals,
  rankRecommendations,
  recommendationRows,
} from "@/backend/personalisation/engine";
import { recommendationHero } from "@/backend/personalisation/hero";
import {
  TasteCandidate,
  TasteProfile,
  TasteType,
} from "@/backend/personalisation/types";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { useSeerrConnection } from "@/stores/seerr";
import { useTasteProfile } from "@/stores/taste";

type Candidate = LibraryTasteCandidate | SeerrTasteCandidate;
interface RecommendationData {
  items: Candidate[];
  activity: TasteCandidate[];
}
const cache = new Map<
  string,
  { at: number; promise: Promise<RecommendationData> }
>();
function candidates(
  source: "library" | "seerr",
  type: TasteType,
  profile: TasteProfile,
  identity: string,
  revision: number,
) {
  const seeds = Object.values(profile.ratings)
    .filter((rating) => ["loved", "liked"].includes(rating.rating))
    .map((rating) => [rating.key, rating.rating, rating.ratedAt]);
  const key = JSON.stringify([
    source,
    source === "library" ? "all" : type,
    identity,
    seeds,
    source === "seerr" ? profile.preferences : undefined,
    revision,
  ]);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.at < 60000) return existing.promise;
  const promise = getTasteLibrary(undefined, revision > 0).then(
    async (library) => {
      if (source === "library")
        return {
          items: await addLibraryRelatedSeeds(library, profile),
          activity: library,
        };
      const discovered = await getSeerrTasteCandidates(
        profile,
        type,
        undefined,
        library,
      );
      const owned = new Map(library.map((item) => [item.media.key, item]));
      return {
        items: discovered.map((item) => {
          const match = owned.get(item.media.key);
          return {
            ...item,
            watched: match?.watched,
            favourite: match?.favourite,
            progress: match?.progress,
          };
        }),
        activity: library,
      };
    },
  );
  if (cache.size >= 20) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}
interface PersonalRecommendations<T extends Candidate> {
  rows: RecommendationRow<T>[];
  ranked: RankedCandidate<T>[];
  hero: T[];
  hasSignals: boolean;
  loading: boolean;
  error: string;
}
export function usePersonalRecommendations(
  source: "library",
  type: TasteType,
  enabled?: boolean,
  revision?: number,
): PersonalRecommendations<LibraryTasteCandidate>;
export function usePersonalRecommendations(
  source: "seerr",
  type: TasteType,
  enabled?: boolean,
  revision?: number,
): PersonalRecommendations<SeerrTasteCandidate>;
export function usePersonalRecommendations(
  source: "library" | "seerr",
  type: TasteType,
  enabled = true,
  revision = 0,
) {
  const session = useJellyfinAuth((state) => state.session);
  const connection = useSeerrConnection((state) => state.connection);
  const profile = useTasteProfile();
  const identity = JSON.stringify([
    session?.serverUrl,
    session?.userId,
    session?.accessToken,
    source === "seerr" ? connection?.url : undefined,
    source === "seerr" ? connection?.userId : undefined,
  ]);
  const [state, setState] = useState<{
    identity: string;
    items: Candidate[];
    activity: TasteCandidate[];
    loading: boolean;
    error: string;
  }>({ identity, items: [], activity: [], loading: false, error: "" });
  const seedSignature = JSON.stringify(
    Object.values(profile.ratings)
      .filter((rating) => ["loved", "liked"].includes(rating.rating))
      .map((rating) => [rating.key, rating.rating, rating.ratedAt]),
  );
  const preferenceSignature =
    source === "seerr" ? JSON.stringify(profile.preferences) : "";
  useEffect(() => {
    if (!enabled || !session || (source === "seerr" && !seerrTasteEnabled()))
      return;
    let active = true;
    setState((current) => ({
      identity,
      items: current.identity === identity ? current.items : [],
      activity: current.identity === identity ? current.activity : [],
      loading: true,
      error: "",
    }));
    candidates(source, type, profile, identity, revision)
      .then((data) => {
        if (active) setState({ identity, ...data, loading: false, error: "" });
      })
      .catch((reason) => {
        if (active)
          setState({
            identity,
            items: [],
            activity: [],
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "Unable to load recommendations.",
          });
      });
    return () => {
      active = false;
    };
    // Preferences are scored locally; only changed positive seeds need new related requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    identity,
    source,
    type,
    seedSignature,
    preferenceSignature,
    revision,
  ]);
  const items = useMemo(
    () => (state.identity === identity ? state.items : []),
    [state.identity, state.items, identity],
  );
  const ranked = useMemo(
    () => rankRecommendations(items, profile, type, Date.now(), state.activity),
    [items, profile, type, state.activity],
  );
  const hero = useMemo(
    () =>
      recommendationHero(
        ranked,
        source === "library"
          ? rankRecommendations(
              items,
              profile,
              type === "movie" ? "tv" : "movie",
              Date.now(),
              state.activity,
            )
          : [],
      ),
    [ranked, source, items, profile, type, state.activity],
  );
  return {
    rows: recommendationRows(ranked),
    ranked,
    hero,
    hasSignals: hasTasteSignals(
      profile,
      state.identity === identity ? state.activity : [],
    ),
    loading: state.loading,
    error: state.error,
  };
}
