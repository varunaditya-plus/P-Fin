import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  FRANCHISES,
  GENRES,
  MOODS,
  RatedTasteMedia,
  TasteMedia,
  TastePreferences,
  TasteProfile,
  TasteRating,
  normaliseGenres,
} from "@/backend/personalisation/types";
import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

export const defaultTasteProfile: TasteProfile = {
  ratings: {},
  preferences: {
    favoriteGenres: [],
    moods: [],
    franchises: [],
    completedQuiz: false,
  },
};
const ratingValues: TasteRating[] = [
  "loved",
  "liked",
  "okay",
  "disliked",
  "hated",
];
function strings(value: unknown, max = 100): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((entry) => typeof entry !== "string" || entry.length > 200)
  )
    throw new Error("Invalid taste preferences.");
  return [...new Set(value)];
}
export function validateTasteMedia(value: unknown): TasteMedia {
  const media = value as TasteMedia | null;
  if (
    !media ||
    !["movie", "tv"].includes(media.type) ||
    typeof media.title !== "string" ||
    !media.title.trim() ||
    media.title.length > 400
  )
    throw new Error("Invalid rated title.");
  const tmdbId =
    typeof media.tmdbId === "number" &&
    Number.isSafeInteger(media.tmdbId) &&
    media.tmdbId > 0
      ? media.tmdbId
      : undefined;
  const jellyfinId =
    typeof media.jellyfinId === "string" &&
    /^[a-z0-9-]{1,100}$/i.test(media.jellyfinId)
      ? media.jellyfinId
      : undefined;
  if (!tmdbId && !jellyfinId)
    throw new Error("This title has no valid media identifier.");
  const key = tmdbId
    ? `tmdb:${media.type}:${tmdbId}`
    : `jellyfin:${media.type}:${jellyfinId}`;
  return {
    key,
    type: media.type,
    title: media.title.trim(),
    genres: normaliseGenres(strings(media.genres ?? [])),
    studios: strings(media.studios ?? []),
    tmdbId,
    jellyfinId,
    year:
      Number.isInteger(media.year) && media.year! >= 1800 && media.year! <= 2200
        ? media.year
        : undefined,
    imageTag:
      typeof media.imageTag === "string" &&
      /^[a-z0-9-]{1,100}$/i.test(media.imageTag)
        ? media.imageTag
        : undefined,
    posterPath:
      typeof media.posterPath === "string" &&
      /^\/[a-z0-9_.-]+$/i.test(media.posterPath)
        ? media.posterPath
        : undefined,
  };
}
export function validateTasteProfile(value: unknown): TasteProfile {
  const input = value as TasteProfile | null;
  if (
    !input ||
    !input.ratings ||
    typeof input.ratings !== "object" ||
    Array.isArray(input.ratings) ||
    Object.keys(input.ratings).length > 10000
  )
    throw new Error("Invalid taste profile.");
  const ratings: Record<string, RatedTasteMedia> = {};
  for (const entry of Object.values(input.ratings)) {
    const media = validateTasteMedia(entry);
    if (
      !ratingValues.includes(entry.rating) ||
      !Number.isFinite(entry.ratedAt) ||
      entry.ratedAt < 0 ||
      entry.ratedAt > Date.now() + 86400000
    )
      throw new Error("Invalid title rating.");
    ratings[media.key] = {
      ...media,
      rating: entry.rating,
      ratedAt: entry.ratedAt,
    };
  }
  const preferences = input.preferences ?? defaultTasteProfile.preferences;
  return {
    ratings,
    preferences: {
      favoriteGenres: strings(preferences.favoriteGenres ?? []).filter(
        (genre) => GENRES.includes(genre),
      ),
      moods: strings(preferences.moods ?? []).filter((id) =>
        MOODS.some((mood) => mood.id === id),
      ),
      franchises: strings(preferences.franchises ?? []).filter((id) =>
        FRANCHISES.some((franchise) => franchise.id === id),
      ),
      completedQuiz: preferences.completedQuiz === true,
    },
  };
}
export function tasteScope() {
  return homePreferenceScope(useJellyfinAuth.getState().session);
}
export const useTasteStore = create(
  persist<{
    profiles: Record<string, TasteProfile>;
    rate: (media: TasteMedia, rating: TasteRating, toggle?: boolean) => void;
    remove: (key: string) => void;
    setPreferences: (patch: Partial<TastePreferences>) => void;
    replaceProfile: (profile: TasteProfile) => void;
  }>(
    (set) => ({
      profiles: {},
      rate: (value, rating, toggle = true) =>
        set((state) => {
          const scope = tasteScope();
          if (!scope) return state;
          const media = validateTasteMedia(value);
          const profile = state.profiles[scope] ?? defaultTasteProfile;
          const ratings = { ...profile.ratings };
          if (toggle && ratings[media.key]?.rating === rating)
            delete ratings[media.key];
          else {
            const existing = ratings[media.key];
            ratings[media.key] = {
              ...media,
              jellyfinId: media.jellyfinId ?? existing?.jellyfinId,
              imageTag: media.imageTag ?? existing?.imageTag,
              posterPath: media.posterPath ?? existing?.posterPath,
              genres: media.genres.length
                ? media.genres
                : (existing?.genres ?? []),
              studios: media.studios.length
                ? media.studios
                : (existing?.studios ?? []),
              rating,
              ratedAt: Date.now(),
            };
          }
          return {
            profiles: { ...state.profiles, [scope]: { ...profile, ratings } },
          };
        }),
      remove: (key) =>
        set((state) => {
          const scope = tasteScope();
          const profile = state.profiles[scope] ?? defaultTasteProfile;
          const ratings = { ...profile.ratings };
          delete ratings[key];
          return {
            profiles: { ...state.profiles, [scope]: { ...profile, ratings } },
          };
        }),
      setPreferences: (patch) =>
        set((state) => {
          const scope = tasteScope();
          const profile = state.profiles[scope] ?? defaultTasteProfile;
          return {
            profiles: {
              ...state.profiles,
              [scope]: validateTasteProfile({
                ...profile,
                preferences: { ...profile.preferences, ...patch },
              }),
            },
          };
        }),
      replaceProfile: (profile) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [tasteScope()]: validateTasteProfile(profile),
          },
        })),
    }),
    {
      name: "movie-fin:taste",
      partialize: (state) => ({ profiles: state.profiles }) as typeof state,
      merge: (saved, current) => {
        const profiles: Record<string, TasteProfile> = {};
        for (const [scope, profile] of Object.entries(
          (saved as { profiles?: Record<string, unknown> })?.profiles ?? {},
        )) {
          try {
            profiles[scope] = validateTasteProfile(profile);
          } catch {
            /* Ignore invalid legacy profiles without affecting other accounts. */
          }
        }
        return { ...current, profiles };
      },
    },
  ),
);
export function getTasteProfile() {
  return useTasteStore.getState().profiles[tasteScope()] ?? defaultTasteProfile;
}
export function useTasteProfile() {
  const session = useJellyfinAuth((state) => state.session);
  return useTasteStore(
    (state) =>
      state.profiles[homePreferenceScope(session)] ?? defaultTasteProfile,
  );
}
registerAppPreferenceSection("taste", {
  label: "Ratings and taste preferences",
  defaults: defaultTasteProfile,
  localFallback: getTasteProfile,
  getSnapshot: getTasteProfile,
  apply: (value) => useTasteStore.getState().replaceProfile(value),
  subscribe: useTasteStore.subscribe,
  validate: validateTasteProfile,
});
