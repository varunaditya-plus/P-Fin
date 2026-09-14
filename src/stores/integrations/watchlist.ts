import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

export interface WatchlistEntry {
  key: string;
  type: "movie" | "tv";
  title: string;
  year?: number;
  jellyfinId?: string;
  tmdbId?: number;
  imdbId?: string;
  addedAt: string;
}

export function validateWatchlist(value: unknown): WatchlistEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = new Map<string, WatchlistEntry>();
  value.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const entry = row as Partial<WatchlistEntry>;
    if (entry.type !== "movie" && entry.type !== "tv") return;
    if (typeof entry.title !== "string" || !entry.title.trim()) return;
    const jellyfinId =
      typeof entry.jellyfinId === "string" &&
      /^[a-f\d]{32}$/i.test(entry.jellyfinId)
        ? entry.jellyfinId
        : undefined;
    const tmdbId =
      Number.isSafeInteger(entry.tmdbId) && (entry.tmdbId ?? 0) > 0
        ? entry.tmdbId
        : undefined;
    if (!jellyfinId && !tmdbId) return;
    const key = tmdbId
      ? `tmdb:${entry.type}:${tmdbId}`
      : `jellyfin:${entry.type}:${jellyfinId}`;
    entries.set(key, {
      key,
      type: entry.type,
      title: entry.title.trim().slice(0, 400),
      jellyfinId,
      tmdbId,
      year:
        Number.isInteger(entry.year) &&
        entry.year! >= 1800 &&
        entry.year! <= 2200
          ? entry.year
          : undefined,
      imdbId:
        typeof entry.imdbId === "string" && /^tt\d+$/.test(entry.imdbId)
          ? entry.imdbId
          : undefined,
      addedAt:
        typeof entry.addedAt === "string" &&
        Number.isFinite(Date.parse(entry.addedAt))
          ? entry.addedAt
          : new Date().toISOString(),
    });
    if (entries.size > 10000)
      throw new Error(
        "Your watchlist is limited to 10,000 titles. Remove some entries before importing more.",
      );
  });
  return [...entries.values()];
}

export const useIntegrationWatchlist = create(
  persist<{
    profiles: Record<string, WatchlistEntry[]>;
    merge(scope: string, entries: WatchlistEntry[]): void;
    remove(scope: string, key: string): void;
  }>(
    (set) => ({
      profiles: {},
      merge: (scope, entries) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: validateWatchlist([
              ...(state.profiles[scope] ?? []),
              ...entries,
            ]),
          },
        })),
      remove: (scope, key) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: (state.profiles[scope] ?? []).filter(
              (entry) => entry.key !== key,
            ),
          },
        })),
    }),
    {
      name: "integration-watchlists",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const currentScope = () =>
  homePreferenceScope(useJellyfinAuth.getState().session);
registerAppPreferenceSection<WatchlistEntry[]>("watchlist", {
  label: "Watchlist",
  defaults: [],
  validate: validateWatchlist,
  getSnapshot: () =>
    useIntegrationWatchlist.getState().profiles[currentScope()] ?? [],
  localFallback: () =>
    useIntegrationWatchlist.getState().profiles[currentScope()] ?? [],
  apply: (entries) => {
    const scope = currentScope();
    if (scope)
      useIntegrationWatchlist.setState((state) => ({
        profiles: { ...state.profiles, [scope]: validateWatchlist(entries) },
      }));
  },
  subscribe: (listener) => useIntegrationWatchlist.subscribe(listener),
});
