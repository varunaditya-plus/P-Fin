import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  LibrarySortBy,
  LibrarySortOrder,
  LibraryStatus,
} from "@/backend/jellyfin/library";

export type LibraryBrowseSort = LibrarySortBy | "SeriesLength";
export type HomeSectionSort = "default" | "title" | "year" | "rating";
export interface LibraryBrowsePreferences {
  sortBy: LibraryBrowseSort;
  sortOrder: LibrarySortOrder;
  status: LibraryStatus;
  genre: string;
  year: string;
}
export const defaultLibraryBrowse: LibraryBrowsePreferences = {
  sortBy: "SortName",
  sortOrder: "Ascending",
  status: "all",
  genre: "",
  year: "",
};
export interface BrowseProfile {
  libraries: Record<string, LibraryBrowsePreferences>;
  sectionSort: Record<string, HomeSectionSort>;
}

export const useBrowsePreferences = create(
  persist<{
    profiles: Record<string, BrowseProfile>;
    updateLibrary: (
      scope: string,
      id: string,
      preferences: LibraryBrowsePreferences,
    ) => void;
    sortSection: (scope: string, id: string, sort: HomeSectionSort) => void;
  }>(
    (set) => ({
      profiles: {},
      updateLibrary: (scope, id, preferences) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: {
              sectionSort: state.profiles[scope]?.sectionSort ?? {},
              libraries: {
                ...state.profiles[scope]?.libraries,
                [id]: preferences,
              },
            },
          },
        })),
      sortSection: (scope, id, sort) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: {
              libraries: state.profiles[scope]?.libraries ?? {},
              sectionSort: {
                ...state.profiles[scope]?.sectionSort,
                [id]: sort,
              },
            },
          },
        })),
    }),
    {
      name: "jellyfin-browse-preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export interface BrowseSession {
  library: string;
  feed: { id: string; title: string } | null;
  genre: string;
  scroll: number;
}
export function readBrowseSession(
  scope: string,
  path: string,
): BrowseSession | undefined {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`jellyfin-browse:${scope}:${path}`) || "null",
    );
    if (
      !value ||
      typeof value.library !== "string" ||
      typeof value.genre !== "string" ||
      !Number.isFinite(value.scroll) ||
      value.scroll < 0 ||
      (value.feed !== null &&
        (typeof value.feed?.id !== "string" ||
          typeof value.feed?.title !== "string"))
    )
      return undefined;
    return value;
  } catch {
    return undefined;
  }
}
export function saveBrowseSession(
  scope: string,
  path: string,
  value: BrowseSession,
) {
  try {
    sessionStorage.setItem(
      `jellyfin-browse:${scope}:${path}`,
      JSON.stringify(value),
    );
  } catch {
    /* Browsing remains available when storage is full. */
  }
}
