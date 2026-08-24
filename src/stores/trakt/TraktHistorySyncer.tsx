import { useCallback, useEffect, useRef, useState } from "react";
import { useInterval } from "react-use";

import { importWatchHistory } from "@/backend/accounts/import";
import {
  watchHistoryItemToInputs,
  watchHistoryItemsToInputs,
} from "@/backend/accounts/watchHistory";
import { getPosterForMedia } from "@/backend/metadata/tmdb";
import { useBackendUrl } from "@/hooks/auth/useBackendUrl";
import { useAuthStore } from "@/stores/auth";
import { useTraktAuthStore } from "@/stores/trakt/store";
import { WatchHistoryItem, useWatchHistoryStore } from "@/stores/watchHistory";
import { traktService } from "@/utils/trakt";
import { TraktContentData } from "@/utils/traktTypes";

const PROGRESS_THRESHOLD = 0.25; // Sync to Trakt if watched >= 25%
const TRAKT_HISTORY_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const INITIAL_SYNC_DELAY_MS = 2000; // Re-sync after backend restore

function toTraktContentData(
  id: string,
  item: WatchHistoryItem,
): TraktContentData | null {
  const { watched, duration } = item.progress;
  const progress = duration > 0 ? watched / duration : 0;
  if (progress < PROGRESS_THRESHOLD) return null;

  const input = watchHistoryItemToInputs(id, item);

  if (item.type === "movie") {
    return {
      type: "movie",
      tmdbId: input.tmdbId,
      title: item.title,
      year: item.year,
    };
  }

  if (
    item.type === "show" &&
    input.seasonNumber != null &&
    input.episodeNumber != null
  ) {
    const showTmdbId = id.includes("-") ? id.split("-")[0] : input.tmdbId;
    const episodeTmdbId =
      item.episodeId ?? (id.includes("-") ? id.split("-")[1] : undefined);
    if (!episodeTmdbId) return null;

    return {
      type: "episode",
      tmdbId: episodeTmdbId,
      title: item.title,
      year: item.year,
      season: input.seasonNumber,
      episode: input.episodeNumber,
      showTitle: item.title,
      showYear: item.year,
      showTmdbId,
    };
  }

  return null;
}

export function TraktHistorySyncer() {
  const { accessToken } = useTraktAuthStore();
  const backendUrl = useBackendUrl();
  const account = useAuthStore((s) => s.account);
  const isSyncingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const syncHistoryFromTrakt = useCallback(async () => {
    if (!accessToken || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const items = await traktService.getHistoryItems();
      const store = useWatchHistoryStore.getState();
      const merged = { ...store.items };

      for (const hi of items) {
        if (hi.type === "movie" && hi.movie) {
          const tmdbId = hi.movie.ids.tmdb?.toString();
          if (!tmdbId) continue;
          if (!merged[tmdbId]) {
            const poster = await getPosterForMedia(tmdbId, "movie");
            merged[tmdbId] = {
              type: "movie",
              title: hi.movie.title,
              year: hi.movie.year,
              poster,
              progress: { watched: 0, duration: 1 },
              watchedAt: new Date(hi.watched_at).getTime(),
              completed: false,
            };
          }
        } else if (hi.type === "episode" && hi.episode && hi.show) {
          const showTmdbId = hi.show.ids.tmdb?.toString();
          const episodeTmdbId = hi.episode.ids?.tmdb?.toString();
          if (!showTmdbId || !episodeTmdbId) continue;
          const key = `${showTmdbId}-${episodeTmdbId}`;
          if (!merged[key]) {
            const poster = await getPosterForMedia(showTmdbId, "show");
            merged[key] = {
              type: "show",
              title: hi.show.title,
              year: hi.show.year,
              poster,
              progress: { watched: 0, duration: 1 },
              watchedAt: new Date(hi.watched_at).getTime(),
              completed: false,
              episodeId: episodeTmdbId,
              seasonNumber: hi.episode.season,
              episodeNumber: hi.episode.number,
            };
          }
        }
      }

      if (Object.keys(merged).length > Object.keys(store.items).length) {
        const newKeys = Object.keys(merged).filter((k) => !(k in store.items));
        useWatchHistoryStore.getState().replaceItems(merged);
        if (backendUrl && account && newKeys.length > 0) {
          const newItems = Object.fromEntries(
            newKeys.map((k) => [k, merged[k]!]),
          );
          try {
            await importWatchHistory(
              backendUrl,
              account,
              watchHistoryItemsToInputs(newItems),
            );
          } catch (err) {
            console.error("Failed to import Trakt history to backend", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync history from Trakt", err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [accessToken, backendUrl, account]);

  const syncHistoryToTrakt = useCallback(async () => {
    if (!accessToken || isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const items = useWatchHistoryStore.getState().items;

      for (const [id, item] of Object.entries(items)) {
        const contentData = toTraktContentData(id, item);
        if (!contentData) continue;

        const input = watchHistoryItemToInputs(id, item);
        const watchedAt = input.watchedAt;

        try {
          await traktService.addToHistory(contentData, watchedAt);
        } catch (err) {
          console.error(`Failed to sync watch history to Trakt: ${id}`, err);
        }
      }
    } catch (error) {
      console.error("Failed to sync watch history to Trakt", error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [accessToken]);

  const fullSync = useCallback(async () => {
    await syncHistoryFromTrakt();
    await syncHistoryToTrakt();
  }, [syncHistoryFromTrakt, syncHistoryToTrakt]);

  useEffect(() => {
    const check = () => useTraktAuthStore.persist?.hasHydrated?.() ?? false;
    if (check()) {
      setHydrated(true);
      return;
    }
    const unsub = useTraktAuthStore.persist?.onFinishHydration?.(() =>
      setHydrated(true),
    );
    const t = setTimeout(() => setHydrated(true), 500);
    return () => {
      unsub?.();
      clearTimeout(t);
    };
  }, []);

  // On mount (after hydration): pull from Trakt immediately, then full sync after delay
  // (delay ensures we run after auth restore overwrites the store)
  useEffect(() => {
    if (!hydrated || !accessToken) return;
    syncHistoryFromTrakt();
    const t = setTimeout(fullSync, INITIAL_SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [hydrated, accessToken, syncHistoryFromTrakt, fullSync]);

  useInterval(fullSync, TRAKT_HISTORY_SYNC_INTERVAL_MS);

  return null;
}
