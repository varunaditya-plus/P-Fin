import {
  JellyfinItem,
  JellyfinItems,
  getItem,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";

import { normalizeLibrarySearch, uniqueLibraryItems } from "./browse";

export async function getLibraryPerson(
  name: string,
  id?: string,
  tmdbId?: number,
  signal?: AbortSignal,
): Promise<JellyfinItem | undefined> {
  if (id) return getItem(id, signal);
  const results = await jellyfinRequest<JellyfinItems>(
    "Persons",
    { signal },
    {
      UserId: getJellyfinSession().userId,
      SearchTerm: name,
      Fields: "Overview,ProviderIds",
      Limit: 30,
    },
  );
  const byId = tmdbId
    ? results.Items.find(
        (person) => person.ProviderIds?.Tmdb === String(tmdbId),
      )
    : undefined;
  const byName = results.Items.filter(
    (person) =>
      normalizeLibrarySearch(person.Name) === normalizeLibrarySearch(name) &&
      (!tmdbId || !person.ProviderIds?.Tmdb),
  );
  const person = byId ?? (byName.length === 1 ? byName[0] : undefined);
  return person ? getItem(person.Id, signal) : undefined;
}

export async function getPersonLibrary(
  personId: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  const page = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      PersonIds: personId,
      Recursive: true,
      IncludeItemTypes: "Movie,Series",
      SortBy: "ProductionYear,SortName",
      SortOrder: "Descending",
      Fields: "Overview,ProviderIds,PrimaryImageAspectRatio",
      EnableUserData: true,
      StartIndex: startIndex ?? 0,
      Limit: 60,
    },
  );
  return {
    ...page,
    FetchedCount: page.Items.length,
    Items: uniqueLibraryItems(page.Items),
  };
}
