import {
  JellyfinItem,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import { getSeerrDetails } from "@/backend/seerr/api";
import {
  WatchlistEntry,
  useIntegrationWatchlist,
} from "@/stores/integrations/watchlist";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

import { candidateWatchlistEntry } from "./letterboxd";
import {
  integrationIdentity,
  integrationLibrary,
  providerId,
  requireIntegrationIdentity,
} from "./library";
import { requireSimklConnection, simklRequest } from "./simkl";

type Ids = Record<string, string | number | undefined>;
interface SimklTitle {
  title?: string;
  year?: number;
  ids: Ids;
}
interface SimklEpisode {
  number: number;
  ids?: { tvdb_id?: number };
  tvdb?: { season: number; episode: number };
}
export interface SimklListItem {
  status: string;
  movie?: SimklTitle;
  show?: SimklTitle;
  anime_type?: string;
  seasons?: { number: number; episodes?: SimklEpisode[] }[];
}
export interface SimklLists {
  movies?: SimklListItem[];
  shows?: SimklListItem[];
  anime?: SimklListItem[];
}
export type SimklSyncMode =
  | "import-watchlist"
  | "export-watchlist"
  | "import-watched"
  | "export-watched";
export interface SimklSyncRow {
  key: string;
  title: string;
  detail: string;
  itemId?: string;
  watchlist?: WatchlistEntry;
  bucket?: "movies" | "shows";
  payload?: Record<string, unknown>;
}
export interface SimklSyncPlan {
  mode: SimklSyncMode;
  identity: ReturnType<typeof integrationIdentity>;
  connectionToken: string;
  rows: SimklSyncRow[];
  skipped: { title: string; reason: string }[];
}

export function sameProvider(item: JellyfinItem, ids: Ids) {
  return ["tmdb", "imdb", "tvdb"].some(
    (provider) =>
      ids[provider] && providerId(item, provider) === String(ids[provider]),
  );
}

function itemIds(item: JellyfinItem): Ids {
  return Object.fromEntries(
    ["tmdb", "imdb", "tvdb"]
      .map((provider) => [provider, providerId(item, provider)])
      .filter(([, value]) => value),
  );
}

function remoteTitle(entry: SimklListItem) {
  return entry.movie ?? entry.show;
}

export function watchedEpisodeMatches(
  item: JellyfinItem,
  remote: SimklListItem,
  anime: boolean,
) {
  return (
    remote.seasons?.some((season) =>
      season.episodes?.some((episode) => {
        const tvdb = providerId(item, "tvdb");
        if (
          tvdb &&
          episode.ids?.tvdb_id &&
          tvdb === String(episode.ids.tvdb_id)
        )
          return true;
        if (anime)
          return Boolean(
            episode.tvdb &&
              item.ParentIndexNumber === episode.tvdb.season &&
              item.IndexNumber === episode.tvdb.episode,
          );
        return (
          item.ParentIndexNumber === season.number &&
          item.IndexNumber === episode.number
        );
      }),
    ) ?? false
  );
}

// Only a manual preview calls this. There is no polling or playback integration.
async function readLists(signal: AbortSignal): Promise<SimklLists> {
  await simklRequest("/sync/activities", { signal });
  return simklRequest(
    "/sync/all-items?extended=full_anime_seasons&include_all_episodes=original&episode_tvdb_id=yes",
    { signal },
  );
}

export async function previewSimklSync(
  mode: SimklSyncMode,
  signal: AbortSignal,
): Promise<SimklSyncPlan> {
  const identity = integrationIdentity();
  const connection = requireSimklConnection();
  const plan: SimklSyncPlan = {
    mode,
    identity,
    connectionToken: connection.accessToken,
    rows: [],
    skipped: [],
  };
  const [library, remote] = await Promise.all([
    integrationLibrary(
      mode.includes("watched") ? "Movie,Series,Episode" : "Movie,Series",
      signal,
    ),
    readLists(signal),
  ]);
  requireIntegrationIdentity(identity);
  if (requireSimklConnection() !== connection)
    throw new Error("Your Simkl connection changed. Preview again.");
  const films = library.filter((item) => item.Type === "Movie");
  const series = library.filter((item) => item.Type === "Series");
  const remoteMovies = remote.movies ?? [];
  const remoteShows = [...(remote.shows ?? []), ...(remote.anime ?? [])];
  const watchlist =
    useIntegrationWatchlist.getState().profiles[identity.scope] ?? [];
  const skip = (title: string, reason: string) =>
    plan.skipped.push({ title, reason });

  if (mode === "import-watchlist" || mode === "import-watched") {
    const entries = [
      ...remoteMovies.map((entry) => ({
        entry,
        type: "movie" as const,
        anime: false,
      })),
      ...(remote.shows ?? []).map((entry) => ({
        entry,
        type: "tv" as const,
        anime: false,
      })),
      ...(remote.anime ?? []).map((entry) => ({
        entry,
        type:
          entry.anime_type === "movie" ? ("movie" as const) : ("tv" as const),
        anime: true,
      })),
    ];
    for (const { entry, type, anime } of entries) {
      signal.throwIfAborted();
      requireIntegrationIdentity(identity);
      const media = remoteTitle(entry);
      if (!media) continue;
      const title = media.title || "Untitled";
      if (mode === "import-watchlist" && entry.status !== "plantowatch")
        continue;
      const candidates = (type === "movie" ? films : series).filter((item) =>
        sameProvider(item, media.ids),
      );
      if (candidates.length > 1) {
        skip(title, "Several Jellyfin items share this provider ID.");
        continue;
      }
      const item = candidates[0];
      if (mode === "import-watchlist") {
        let tmdbId = item
          ? Number(providerId(item, "tmdb")) || undefined
          : Number(media.ids.tmdb) || undefined;
        if (!item) {
          const seerr = useSeerrConnection.getState().connection;
          if (!tmdbId || !matchesSeerrSession(seerr, getJellyfinSession())) {
            skip(title, "No accessible Jellyfin match or enabled Seerr match.");
            continue;
          }
          try {
            const details = await getSeerrDetails(tmdbId, type, signal);
            tmdbId = details.id;
          } catch (error) {
            signal.throwIfAborted();
            skip(
              title,
              error instanceof Error
                ? error.message
                : "Seerr match unavailable.",
            );
            continue;
          }
        }
        const candidate = candidateWatchlistEntry(
          {
            title: item?.Name || title,
            year: item?.ProductionYear || media.year,
            jellyfinId: item?.Id,
            tmdbId,
            imdbId: item
              ? providerId(item, "imdb")
              : typeof media.ids.imdb === "string"
                ? media.ids.imdb
                : undefined,
          },
          type,
        );
        if (watchlist.some((existing) => existing.key === candidate.key)) {
          skip(title, "Already in your watchlist.");
          continue;
        }
        plan.rows.push({
          key: candidate.key,
          title,
          detail: item
            ? "Add library title to watchlist"
            : "Add Seerr title to watchlist",
          watchlist: candidate,
        });
      } else if (type === "movie") {
        if (entry.status !== "completed") continue;
        if (!item) {
          skip(title, "No accessible Jellyfin match.");
          continue;
        }
        if (item.UserData?.Played) {
          skip(title, "Already watched in Jellyfin.");
          continue;
        }
        plan.rows.push({
          key: item.Id,
          title,
          detail: "Mark film watched in Jellyfin",
          itemId: item.Id,
        });
      } else {
        if (!entry.seasons?.some((season) => season.episodes?.length)) {
          if (entry.status !== "plantowatch")
            skip(
              title,
              "No individually recorded episodes; whole-series status is not imported.",
            );
          continue;
        }
        if (!item) {
          skip(title, "No accessible Jellyfin series match.");
          continue;
        }
        const episodes = library.filter(
          (episode) =>
            episode.Type === "Episode" &&
            episode.SeriesId === item.Id &&
            watchedEpisodeMatches(episode, entry, anime),
        );
        if (!episodes.length)
          skip(
            title,
            "No episode IDs or verified season/episode mappings match your library.",
          );
        episodes.forEach((episode) => {
          if (episode.UserData?.Played) {
            skip(`${title} · ${episode.Name}`, "Already watched in Jellyfin.");
            return;
          }
          plan.rows.push({
            key: episode.Id,
            title: `${title} · ${episode.Name}`,
            detail: `Mark S${episode.ParentIndexNumber} E${episode.IndexNumber} watched`,
            itemId: episode.Id,
          });
        });
      }
    }
  } else if (mode === "export-watchlist") {
    watchlist.forEach((entry) => {
      const ids = { tmdb: entry.tmdbId, imdb: entry.imdbId };
      if (!ids.tmdb && !ids.imdb) {
        skip(entry.title, "No TMDB or IMDb ID available.");
        return;
      }
      const existing = (
        entry.type === "movie" ? remoteMovies : remoteShows
      ).some((row) =>
        Object.entries(ids).some(
          ([key, value]) =>
            value && String(remoteTitle(row)?.ids[key]) === String(value),
        ),
      );
      if (existing) {
        skip(
          entry.title,
          "Already tracked by Simkl; existing status is preserved.",
        );
        return;
      }
      plan.rows.push({
        key: entry.key,
        title: entry.title,
        detail: "Add to Simkl Plan to Watch",
        bucket: entry.type === "movie" ? "movies" : "shows",
        payload: {
          ids,
          type: entry.type === "movie" ? "movie" : "show",
          to: "plantowatch",
        },
      });
    });
  } else {
    films
      .filter((item) => item.UserData?.Played)
      .forEach((item) => {
        const ids = itemIds(item);
        if (!Object.keys(ids).length) {
          skip(item.Name, "No provider IDs available.");
          return;
        }
        if (
          remoteMovies.some(
            (entry) =>
              entry.status === "completed" &&
              sameProvider(item, remoteTitle(entry)?.ids ?? {}),
          )
        ) {
          skip(item.Name, "Already watched in Simkl.");
          return;
        }
        plan.rows.push({
          key: item.Id,
          title: item.Name,
          detail: "Mark film watched in Simkl",
          bucket: "movies",
          payload: { ids, type: "movie" },
        });
      });
    library
      .filter((item) => item.Type === "Episode" && item.UserData?.Played)
      .forEach((episode) => {
        const show = series.find((item) => item.Id === episode.SeriesId);
        if (
          !show ||
          !Object.keys(itemIds(show)).length ||
          episode.ParentIndexNumber === undefined ||
          episode.IndexNumber === undefined
        ) {
          skip(
            episode.Name,
            "Series provider ID or episode numbering missing.",
          );
          return;
        }
        const existing = remoteShows.find((entry) =>
          sameProvider(show, remoteTitle(entry)?.ids ?? {}),
        );
        if (
          existing &&
          watchedEpisodeMatches(episode, existing, Boolean(existing.anime_type))
        ) {
          skip(`${show.Name} · ${episode.Name}`, "Already watched in Simkl.");
          return;
        }
        plan.rows.push({
          key: episode.Id,
          title: `${show.Name} · ${episode.Name}`,
          detail: `Mark S${episode.ParentIndexNumber} E${episode.IndexNumber} watched in Simkl`,
          bucket: "shows",
          payload: {
            ids: itemIds(show),
            type: "show",
            use_tvdb_anime_seasons: true,
            seasons: [
              {
                number: episode.ParentIndexNumber,
                episodes: [{ number: episode.IndexNumber }],
              },
            ],
          },
        });
      });
  }
  requireIntegrationIdentity(identity);
  signal.throwIfAborted();
  plan.rows = [...new Map(plan.rows.map((row) => [row.key, row])).values()];
  return plan;
}

export async function applySimklSync(
  plan: SimklSyncPlan,
  selected: Set<string>,
  signal: AbortSignal,
  progress: (count: number) => void,
) {
  const check = () => {
    signal.throwIfAborted();
    requireIntegrationIdentity(plan.identity);
    if (requireSimklConnection().accessToken !== plan.connectionToken)
      throw new Error("Your Simkl connection changed. Preview again.");
  };
  check();
  const rows = plan.rows.filter((row) => selected.has(row.key));
  const failures: { title: string; reason: string }[] = [];
  let applied = 0;
  if (plan.mode.startsWith("export")) {
    for (let offset = 0; offset < rows.length; offset += 50) {
      check();
      const batch = rows.slice(offset, offset + 50);
      try {
        const result = await simklRequest<{
          not_found?: { movies?: { ids?: Ids }[]; shows?: { ids?: Ids }[] };
        }>(
          plan.mode === "export-watchlist"
            ? "/sync/add-to-list"
            : "/sync/history",
          {
            method: "POST",
            signal,
            body: JSON.stringify({
              movies: batch
                .filter((row) => row.bucket === "movies")
                .map((row) => row.payload),
              shows: batch
                .filter((row) => row.bucket === "shows")
                .map((row) => row.payload),
            }),
          },
        );
        check();
        const missing = [
          ...(result.not_found?.movies ?? []),
          ...(result.not_found?.shows ?? []),
        ];
        for (const row of batch) {
          const ids = row.payload?.ids as Ids;
          if (
            missing.some((item) =>
              Object.entries(ids).some(
                ([provider, id]) =>
                  id && String(item.ids?.[provider]) === String(id),
              ),
            )
          )
            failures.push({
              title: row.title,
              reason: "Simkl could not match the supplied provider IDs.",
            });
          else applied += 1;
        }
      } catch (error) {
        check();
        // Stop after a failed batch: do not repeat a rejected or rate-limited write.
        rows.slice(offset).forEach((row) =>
          failures.push({
            title: row.title,
            reason:
              error instanceof Error
                ? error.message
                : "Simkl export interrupted.",
          }),
        );
        break;
      }
      progress(Math.min(offset + 50, rows.length));
    }
    return { applied, failures };
  }
  for (let index = 0; index < rows.length; index += 1) {
    check();
    const row = rows[index];
    try {
      if (row.watchlist)
        useIntegrationWatchlist
          .getState()
          .merge(plan.identity.scope, [row.watchlist]);
      else if (row.itemId) {
        const userId = getJellyfinSession().userId;
        const item = await jellyfinRequest<JellyfinItem>(
          `Users/${userId}/Items/${row.itemId}`,
          { signal },
        );
        check();
        if (!item.UserData?.Played)
          await jellyfinRequest(`Users/${userId}/PlayedItems/${row.itemId}`, {
            method: "POST",
            signal,
          });
      }
      check();
      applied += 1;
    } catch (error) {
      check();
      failures.push({
        title: row.title,
        reason:
          error instanceof Error
            ? error.message
            : "Unable to import this title.",
      });
    }
    progress(index + 1);
  }
  return { applied, failures };
}
