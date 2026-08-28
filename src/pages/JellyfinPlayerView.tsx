import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { downloadCaption } from "@/backend/helpers/subs";
import {
  JellyfinItem,
  getEpisodes,
  getItem,
  jellyfinUrl,
} from "@/backend/jellyfin/client";
import {
  JellyfinMediaSource,
  JellyfinPlayback,
  PlaybackOptions,
  getPlayback,
  reportPlayback,
  stopTranscode,
} from "@/backend/jellyfin/playback";
import { Button } from "@/components/buttons/Button";
import { Spinner } from "@/components/layout/Spinner";
import { JellyfinPlaybackContext } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { PlayerPart } from "@/pages/parts/player/PlayerPart";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";
import { useVolumeStore } from "@/stores/volume";

let playbackReportQueue = Promise.resolve();

function JellyfinSessionReporter({ playback }: { playback: JellyfinPlayback }) {
  useEffect(() => {
    let started = false;
    let stopped = false;
    let lastReported = 0;
    let lastPaused = true;
    let state = {
      time: 0,
      paused: true,
      muted: false,
      volume: 1,
      subtitleIndex: -1,
    };
    const send = (event: "Playing" | "Progress" | "Stopped") => {
      const snapshot = { ...state };
      playbackReportQueue = playbackReportQueue
        .then(() => reportPlayback(event, playback, snapshot))
        .catch(() => {
          /* A temporary reporting failure must not interrupt playback. */
        });
    };
    const update = () => {
      const store = usePlayerStore.getState();
      if (store.meta?.jellyfinItemId !== playback.itemId || stopped) return;
      state = {
        time: store.progress.time,
        paused: store.mediaPlaying.isPaused,
        muted: store.mediaPlaying.volume === 0,
        volume: store.mediaPlaying.volume,
        subtitleIndex: store.caption.selected
          ? Number(store.caption.selected.id.replace("jellyfin-", ""))
          : playback.subtitleIndex,
      };
      if (!store.mediaPlaying.hasPlayedOnce) return;
      if (!started) {
        started = true;
        send("Playing");
        lastReported = Date.now();
      } else if (
        lastPaused !== state.paused ||
        Date.now() - lastReported > 10000
      ) {
        send("Progress");
        lastReported = Date.now();
      }
      lastPaused = state.paused;
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (started) send("Stopped");
      stopTranscode(playback).catch(() => {});
    };
    const unsubscribe = usePlayerStore.subscribe(update);
    const timer = window.setInterval(update, 10000);
    const pageHide = () => {
      if (stopped) return;
      stopped = true;
      if (started) reportPlayback("Stopped", playback, state).catch(() => {});
      stopTranscode(playback).catch(() => {});
    };
    window.addEventListener("pagehide", pageHide);
    update();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", pageHide);
      stop();
    };
  }, [playback]);
  return null;
}

export function JellyfinPlayerView() {
  const { itemId = "" } = useParams();
  const [search] = useSearchParams();
  const restart = search.get("restart") === "true";
  const navigate = useNavigate();
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [playback, setPlayback] = useState<JellyfinPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [maxBitrate, setMaxBitrate] = useState(120_000_000);
  const generation = useRef(0);
  const subtitleGeneration = useRef(0);
  const subtitleSelection = useRef(-1);
  const lastOptions = useRef<PlaybackOptions>({});
  const status = usePlayerStore((state) => state.status);
  const fallbackAttempted = useRef(false);

  const load = useCallback(
    async (
      target: JellyfinItem,
      options: PlaybackOptions,
      startAt: number,
      preservePause = false,
    ) => {
      generation.current += 1;
      const request = generation.current;
      const selection = subtitleSelection.current;
      const subtitleRequest = subtitleGeneration.current;
      const previousState = usePlayerStore.getState();
      const wasPaused = preservePause && previousState.mediaPlaying.isPaused;
      const previouslyPlayed =
        preservePause && previousState.mediaPlaying.hasPlayedOnce;
      setBusy(true);
      setError(null);
      try {
        const result = await getPlayback(target.Id, options);
        if (request !== generation.current) return;
        lastOptions.current = {
          ...options,
          mediaSourceId: result.mediaSource.Id,
        };
        const store = usePlayerStore.getState();
        store.setCaption(null);
        usePlayerStore.setState((state) => {
          state.progress.time = startAt;
          state.progress.duration = (target.RunTimeTicks ?? 0) / 10_000_000;
          state.progress.buffered = 0;
          state.mediaPlaying.hasPlayedOnce = previouslyPlayed;
        });
        setPlayback(result);
        store.setSource(result.source, result.captions, startAt, !wasPaused);
        store.setSourceId("jellyfin");
        store.display?.setVolume(useVolumeStore.getState().volume);
        setBusy(false);
        const caption = result.captions.find(
          (entry) => entry.id === `jellyfin-${selection}`,
        );
        if (caption && result.subtitleIndex < 0) {
          const srtData = await downloadCaption(caption);
          if (
            request !== generation.current ||
            subtitleRequest !== subtitleGeneration.current
          )
            return;
          store.setCaption({ ...caption, srtData });
          useSubtitleStore
            .getState()
            .setSubtitle(true, caption.language, caption.id);
        }
      } catch (cause) {
        if (request !== generation.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Jellyfin could not prepare playback.",
        );
        usePlayerStore.getState().setStatus(playerStatus.PLAYBACK_ERROR);
      } finally {
        if (request === generation.current) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    subtitleGeneration.current += 1;
    fallbackAttempted.current = false;
    setItem(null);
    setEpisodes([]);
    setPlayback(null);
    setError(null);
    setSubtitleIndex(-1);
    subtitleSelection.current = -1;
    setBusy(true);
    const store = usePlayerStore.getState();
    store.reset();
    const prepare = async () => {
      try {
        const target = await getItem(itemId);
        if (cancelled) return;
        if (
          target.Type !== "Movie" &&
          target.Type !== "Episode" &&
          target.Type !== "Video"
        ) {
          throw new Error(
            "Choose a movie or an episode from your Jellyfin library.",
          );
        }
        const source = (
          target.MediaSources as JellyfinMediaSource[] | undefined
        )?.[0];
        const seriesId = target.SeriesId;
        const queue = seriesId ? await getEpisodes(seriesId) : [];
        if (cancelled) return;
        setItem(target);
        setEpisodes(
          queue.filter(
            (episode) => !episode.IsMissing && !episode.IsVirtualItem,
          ),
        );
        store.setMeta({
          type: target.Type === "Episode" ? "show" : "movie",
          title: target.SeriesName ?? target.Name,
          tmdbId: target.SeriesId ?? target.Id,
          jellyfinItemId: target.Id,
          jellyfinSeriesId: target.SeriesId,
          jellyfinGenres: target.Genres,
          jellyfinRating: target.CommunityRating,
          releaseYear: target.ProductionYear ?? 0,
          overview: target.Overview,
          poster: jellyfinUrl(
            `/Items/${seriesId ?? target.Id}/Images/Primary`,
            { maxWidth: 400 },
          ),
          episode:
            target.Type === "Episode"
              ? {
                  number: target.IndexNumber ?? 0,
                  tmdbId: target.Id,
                  title: target.Name,
                  overview: target.Overview,
                }
              : undefined,
          season:
            target.Type === "Episode"
              ? {
                  number: target.ParentIndexNumber ?? 0,
                  tmdbId: target.SeasonId ?? "",
                  title: `Season ${target.ParentIndexNumber ?? 0}`,
                }
              : undefined,
        });
        const resume = restart
          ? 0
          : (target.UserData?.PlaybackPositionTicks ?? 0) / 10_000_000;
        await load(
          target,
          { mediaSourceId: source?.Id, subtitleIndex: -1 },
          resume,
        );
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load this Jellyfin item.",
        );
        setBusy(false);
      }
    };
    prepare();
    return () => {
      cancelled = true;
      generation.current += 1;
      subtitleGeneration.current += 1;
      store.display?.pause();
      store.reset();
    };
  }, [itemId, restart, load]);

  const reload = useCallback(
    (options: PlaybackOptions) => {
      if (!item) return;
      const time = usePlayerStore.getState().progress.time;
      load(item, { ...lastOptions.current, ...options }, time, true);
    },
    [item, load],
  );

  useEffect(() => {
    if (status !== playerStatus.PLAYBACK_ERROR || !playback || busy || error)
      return;
    if (!lastOptions.current.forceTranscode && !fallbackAttempted.current) {
      fallbackAttempted.current = true;
      setMaxBitrate(20_000_000);
      reload({ forceTranscode: true, maxBitrate: 20_000_000 });
    } else
      setError(
        "Jellyfin could not play this stream. Retry with a compatible stream.",
      );
  }, [status, playback, busy, error, reload]);

  useEffect(() => {
    if (!playback || busy || error) return;
    const timeout = window.setTimeout(() => {
      const store = usePlayerStore.getState();
      if (
        store.meta?.jellyfinItemId === playback.itemId &&
        store.mediaPlaying.isLoading
      ) {
        setError(
          "Jellyfin is taking too long to prepare this stream. Retry playback with a compatible stream.",
        );
        store.display?.pause();
      }
    }, 75_000);
    return () => window.clearTimeout(timeout);
  }, [playback, busy, error]);

  const changeSubtitle = useCallback(
    async (index: number) => {
      if (!playback) return;
      subtitleGeneration.current += 1;
      const request = subtitleGeneration.current;
      const track = playback.mediaSource.MediaStreams?.find(
        (stream) => stream.Type === "Subtitle" && stream.Index === index,
      );
      const wasBurnedIn = playback.subtitleIndex >= 0;
      const nextBurnedIn = track && !track.IsTextSubtitleStream;
      usePlayerStore.getState().setCaption(null);
      setSubtitleIndex(index);
      subtitleSelection.current = index;
      if (wasBurnedIn || nextBurnedIn) {
        if (!item) return;
        await load(
          item,
          {
            ...lastOptions.current,
            subtitleIndex: nextBurnedIn ? index : -1,
            forceTranscode: lastOptions.current.forceTranscode,
          },
          usePlayerStore.getState().progress.time,
          true,
        );
        return;
      }
      if (!track || nextBurnedIn || request !== subtitleGeneration.current)
        return;
      const caption = playback.captions.find(
        (entry) => entry.id === `jellyfin-${index}`,
      );
      if (!caption) return;
      try {
        const srtData = await downloadCaption(caption);
        if (request !== subtitleGeneration.current) return;
        usePlayerStore.getState().setCaption({ ...caption, srtData });
        useSubtitleStore
          .getState()
          .setSubtitle(true, caption.language, caption.id);
      } catch {
        if (request === subtitleGeneration.current) {
          setSubtitleIndex(-1);
          subtitleSelection.current = -1;
          setError(
            "Jellyfin could not load this subtitle track. Choose another track or retry playback.",
          );
        }
      }
    },
    [playback, item, load],
  );

  const controls = useMemo(
    () => ({
      playback,
      episodes,
      itemId,
      busy,
      subtitleIndex,
      maxBitrate,
      playItem: (id: string, fromStart = false) =>
        navigate(`/play/${id}${fromStart ? "?restart=true" : ""}`),
      changeAudio: (index: number) => {
        reload({ audioIndex: index });
      },
      changeSubtitle: (index: number) => {
        changeSubtitle(index);
      },
      changeQuality: (bitrate: number) => {
        setMaxBitrate(bitrate);
        reload({
          maxBitrate: bitrate,
          forceTranscode: bitrate < 120_000_000,
        });
      },
    }),
    [
      playback,
      episodes,
      itemId,
      busy,
      subtitleIndex,
      maxBitrate,
      navigate,
      reload,
      changeSubtitle,
    ],
  );

  return (
    <JellyfinPlaybackContext.Provider value={controls}>
      {playback ? <JellyfinSessionReporter playback={playback} /> : null}
      <PlayerPart backUrl="/" jellyfin>
        {busy || error ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background-main/90 p-8">
            <div className="max-w-lg text-center space-y-5">
              {busy ? (
                <>
                  <Spinner className="mx-auto text-4xl" />
                  <p className="text-white">Preparing Jellyfin playback…</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-white">
                    Unable to play
                  </h1>
                  <p className="text-type-secondary">{error}</p>
                  <div className="flex justify-center gap-3">
                    <Button theme="secondary" href="/">
                      Back to library
                    </Button>
                    {item ? (
                      <Button
                        onClick={() => {
                          setMaxBitrate(20_000_000);
                          reload({
                            forceTranscode: true,
                            maxBitrate: 20_000_000,
                          });
                        }}
                      >
                        Retry playback
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </PlayerPart>
    </JellyfinPlaybackContext.Provider>
  );
}

export default JellyfinPlayerView;
