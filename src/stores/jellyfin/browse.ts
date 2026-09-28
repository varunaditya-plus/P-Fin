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
