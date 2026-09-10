import { useJellyfinAuth } from "@/stores/jellyfin";
import {
  BrowseProfile,
  LibraryBrowsePreferences,
  useBrowsePreferences,
} from "@/stores/jellyfin/browse";
import { homePreferenceScope } from "@/stores/jellyfin/home";

import { registerAppPreferenceSection } from "./registry";

const defaults: BrowseProfile = { libraries: {}, sectionSort: {} };
export function validateBrowseProfile(value: unknown): BrowseProfile {
  const profile = value as BrowseProfile | null;
  if (
    !profile ||
    !profile.libraries ||
    !profile.sectionSort ||
    typeof profile.libraries !== "object" ||
    typeof profile.sectionSort !== "object" ||
    Array.isArray(profile.libraries) ||
    Array.isArray(profile.sectionSort)
  )
    throw new Error("Invalid library browsing preferences.");
  const libraries: Record<string, LibraryBrowsePreferences> = {};
  for (const [id, entry] of Object.entries(profile.libraries)) {
    if (
      id.length > 200 ||
      !entry ||
      ![
        "SortName",
        "DateCreated",
        "ProductionYear",
        "CommunityRating",
        "Runtime",
        "SeriesLength",
      ].includes(entry.sortBy) ||
      !["Ascending", "Descending"].includes(entry.sortOrder) ||
      !["all", "IsPlayed", "IsUnplayed", "IsFavorite", "IsResumable"].includes(
        entry.status,
      ) ||
      typeof entry.genre !== "string" ||
      entry.genre.length > 200 ||
      typeof entry.year !== "string" ||
      (entry.year !== "" && !/^(18|19|20|21)\d{2}$/.test(entry.year))
    )
      throw new Error("Invalid library filters or sorting.");
    libraries[id] = {
      sortBy: entry.sortBy,
      sortOrder: entry.sortOrder,
      status: entry.status,
      genre: entry.genre,
      year: entry.year,
    };
  }
  const sectionSort: BrowseProfile["sectionSort"] = {};
  for (const [id, sort] of Object.entries(profile.sectionSort)) {
    if (
      id.length > 200 ||
      !["default", "title", "year", "rating"].includes(sort)
    )
      throw new Error("Invalid carousel sorting.");
    sectionSort[id] = sort;
  }
  return { libraries, sectionSort };
}
function current() {
  return (
    useBrowsePreferences.getState().profiles[
      homePreferenceScope(useJellyfinAuth.getState().session)
    ] ?? defaults
  );
}
export function registerBrowsePreferences() {
  registerAppPreferenceSection("browse", {
    label: "Library filters and sorting",
    defaults,
    localFallback: current,
    getSnapshot: current,
    apply: (profile) =>
      useBrowsePreferences.setState((state) => ({
        profiles: {
          ...state.profiles,
          [homePreferenceScope(useJellyfinAuth.getState().session)]: profile,
        },
      })),
    subscribe: useBrowsePreferences.subscribe,
    validate: validateBrowseProfile,
  });
}
