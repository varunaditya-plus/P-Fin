import { useCallback, useEffect, useRef } from "react";
import { useInterval } from "react-use";

import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { useTraktAuthStore } from "@/stores/trakt/store";
import { traktService } from "@/utils/trakt";
import { TraktContentData } from "@/utils/traktTypes";

export function TraktScrobbler() {
  const { accessToken } = useTraktAuthStore();
  const { status, meta } = usePlayerStore((s) => ({
    status: s.status,
    meta: s.meta,
  }));

  const lastStatusRef = useRef(status);
  const lastScrobbleRef = useRef<{
    contentData: TraktContentData;
    progressPercent: number;
  } | null>(null);

  // Helper to construct content data
  const getContentData = useCallback((): TraktContentData | null => {
    if (!meta) return null;
    const data: TraktContentData = {
      title: meta.title,
      year: meta.releaseYear,
      tmdbId: meta.tmdbId,
      type: meta.type === "movie" ? "movie" : "episode",
    };

    if (meta.type === "show") {
      if (!meta.season || !meta.episode) return null;
      data.season = meta.season.number;
      data.episode = meta.episode.number;
      data.showTitle = meta.title;
      data.showYear = meta.releaseYear;
      data.showTmdbId = meta.tmdbId;
      data.tmdbId = meta.episode.tmdbId;
    }

    return data;
  }, [meta]);

  // Handle Status Changes
  useEffect(() => {
    if (!accessToken) return;

    const contentData = getContentData();
    const { progress } = usePlayerStore.getState();
    const progressPercent =
      progress.duration > 0 ? (progress.time / progress.duration) * 100 : 0;

    const handleStatusChange = async () => {
      // When we have content, cache it for use when we transition to IDLE
      // (reset() clears meta before we can read it, so we need the cached values)
      if (contentData) {
        lastScrobbleRef.current = { contentData, progressPercent };
      }

      // PLAYING
      if (
        status === playerStatus.PLAYING &&
        lastStatusRef.current !== playerStatus.PLAYING
      ) {
        if (contentData) {
          await traktService.startWatching(contentData, progressPercent);
        }
      }
      // STOPPED / IDLE - use cached data since meta is already null
      else if (
        status === playerStatus.IDLE &&
        lastStatusRef.current !== playerStatus.IDLE
      ) {
        const cached = lastScrobbleRef.current;
        if (cached) {
          await traktService.stopWatching(
            cached.contentData,
            cached.progressPercent,
          );
          lastScrobbleRef.current = null;
        }
      }
      // PAUSED (Any other state coming from PLAYING)
      else if (
        status !== playerStatus.PLAYING &&
        lastStatusRef.current === playerStatus.PLAYING
      ) {
        if (contentData) {
          await traktService.pauseWatching(contentData, progressPercent);
        }
      }

      lastStatusRef.current = status;
    };

    handleStatusChange();
  }, [accessToken, status, getContentData, meta]);

  // Periodic Update (Keep Alive / Progress Update)
  useInterval(() => {
    if (!accessToken || !meta || status !== playerStatus.PLAYING) return;

    const contentData = getContentData();
    if (!contentData) return;

    const { progress } = usePlayerStore.getState();
    const progressPercent =
      progress.duration > 0 ? (progress.time / progress.duration) * 100 : 0;

    traktService
      .startWatching(contentData, progressPercent)
      .catch(console.error);
  }, 10000);

  // Send stop when user closes tab or navigates away
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cached = lastScrobbleRef.current;
      if (cached) {
        traktService.stopWatchingOnUnload(
          cached.contentData,
          cached.progressPercent,
        );
      }
    };
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => window.removeEventListener("pagehide", handleBeforeUnload);
  }, []);

  return null;
}
