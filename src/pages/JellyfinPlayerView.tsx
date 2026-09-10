import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { downloadCaption } from "@/backend/helpers/subs";
import {
  JellyfinItem,
  getEpisodes,
  getImageUrl,
  getItem,
  jellyfinUrl,
} from "@/backend/jellyfin/client";
import { episodeQueue } from "@/backend/jellyfin/episodeQueue";
import {
  JellyfinMediaSource,
  JellyfinPlayback,
  PlaybackOptions,
  getPlayback,
  reportPlayback,
  stopTranscode,
} from "@/backend/jellyfin/playback";
import { getInitialPlaybackSelection } from "@/backend/jellyfin/playbackSelection";
import {
  getPreferredPlaybackOptions,
  getUserConfiguration,
  rememberTrackSelection,
} from "@/backend/jellyfin/preferences";
import { Button } from "@/components/buttons/Button";
import { Spinner } from "@/components/layout/Spinner";
import { JellyfinPlaybackContext } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { useChromecastState } from "@/components/player/remote/chromecast";
import { JellyfinChromecastProvider } from "@/components/player/remote/JellyfinChromecast";
import { JellyfinSyncPlayProvider } from "@/components/player/remote/JellyfinSyncPlay";
import {
  localPlayback,
  selectRemoteItem,
} from "@/components/player/remote/playbackCommands";
import { useSyncPlayState } from "@/components/player/remote/syncplay";
import { PlayerPart } from "@/pages/parts/player/PlayerPart";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
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
  const casting = useChromecastState((state) => state.casting);
  const castConnected = useChromecastState((state) => state.connected);
  const syncGroup = useSyncPlayState((state) => state.group);
  const [castSuspended, setCastSuspended] = useState(false);
  const [search] = useSearchParams();
  const restart = search.get("restart") === "true";
  const mediaSourceId = search.get("mediaSourceId");
  const startTicks = search.get("startTicks");
  const requestedAudio = search.get("audioIndex");
  const requestedSubtitle = search.get("subtitleIndex");
  const shuffle = search.get("shuffle");
  const shuffleSeason = search.get("shuffleSeason");
  const navigate = useNavigate();
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [playback, setPlayback] = useState<JellyfinPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [maxBitrate, setMaxBitrate] = useState(120_000_000);
  const selectedBitrate = useRef(120_000_000);
  const generation = useRef(0);
  const subtitleGeneration = useRef(0);
  const subtitleDownload = useRef<AbortController>();
  const subtitleSelection = useRef(-1);
  const lastOptions = useRef<PlaybackOptions>({});
  const status = usePlayerStore((state) => state.status);
  const fallbackAttempted = useRef(false);
  const configuration = useRef<
    Awaited<ReturnType<typeof getUserConfiguration>>
  >({});
  const rememberedTracks = useRef<ReturnType<typeof rememberTrackSelection>>();

  const load = useCallback(
    async (
      target: JellyfinItem,
      options: PlaybackOptions,
      startAt: number,
      preservePause = false,
      autoplay: boolean | undefined = undefined,
    ) => {
      generation.current += 1;
      subtitleDownload.current?.abort();
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
        store.setSource(
          result.source,
          result.captions,
          startAt,
          autoplay ??
            (!wasPaused &&
              !useSyncPlayState.getState().group &&
              !useChromecastState.getState().casting),
        );
        store.display?.setVolume(useVolumeStore.getState().volume);
        setBusy(false);
        const caption = result.captions.find(
          (entry) => entry.id === `jellyfin-${selection}`,
        );
        if (caption && result.subtitleIndex < 0) {
          const controller = new AbortController();
          subtitleDownload.current = controller;
          const srtData = await downloadCaption(caption, controller.signal);
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
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
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
    localPlayback(() => store.reset());
    const prepare = async () => {
      try {
        const [target, userConfiguration] = await Promise.all([
          getItem(itemId),
          getUserConfiguration().catch(() => ({})),
        ]);
        if (cancelled) return;
        configuration.current = userConfiguration;
        usePreferencesStore
          .getState()
          .setEnableAutoplay(
            configuration.current.EnableNextEpisodeAutoPlay ?? true,
          );
        if (
          !["Movie", "Episode", "Video", "Trailer", "MusicVideo"].includes(
            target.Type,
          )
        ) {
          throw new Error(
            "Choose a movie or an episode from your Jellyfin library.",
          );
        }
        const selectionQuery = new URLSearchParams();
        if (mediaSourceId) selectionQuery.set("mediaSourceId", mediaSourceId);
        if (startTicks !== null) selectionQuery.set("startTicks", startTicks);
        if (requestedAudio !== null)
          selectionQuery.set("audioIndex", requestedAudio);
        if (requestedSubtitle !== null)
          selectionQuery.set("subtitleIndex", requestedSubtitle);
        if (restart) selectionQuery.set("restart", "true");
        const {
          mediaSource: source,
          startAt,
          audioIndex,
          subtitleIndex: initialSubtitle,
        } = getInitialPlaybackSelection(target, selectionQuery);
        // Jellyfin's subtitle default is based on its selected audio. Recompute
        // language-dependent preferences when the details modal overrides it.
        const preferenceSource =
          source &&
          audioIndex !== undefined &&
          audioIndex !== source.DefaultAudioStreamIndex
            ? {
                ...source,
                DefaultAudioStreamIndex: audioIndex,
                DefaultSubtitleStreamIndex: undefined,
              }
            : source;
        const preferredTracks = preferenceSource
          ? getPreferredPlaybackOptions(
              preferenceSource,
              configuration.current,
              audioIndex !== undefined && rememberedTracks.current
                ? {
                    ...rememberedTracks.current,
                    audioLanguage: undefined,
                    audioCodec: undefined,
                  }
                : rememberedTracks.current,
              target.OriginalLanguage,
            )
          : { subtitleIndex: -1 };
        const selectedTracks = {
          ...preferredTracks,
          ...(audioIndex !== undefined ? { audioIndex } : {}),
          ...(initialSubtitle !== undefined
            ? { subtitleIndex: initialSubtitle }
            : {}),
        };
        if (
          source &&
          (audioIndex !== undefined || initialSubtitle !== undefined)
        ) {
          rememberedTracks.current = rememberTrackSelection(
            source,
            selectedTracks.audioIndex,
            selectedTracks.subtitleIndex,
          );
        }
        const subtitle = (
          source as JellyfinMediaSource | undefined
        )?.MediaStreams?.find(
          (track) =>
            track.Type === "Subtitle" &&
            track.Index === selectedTracks.subtitleIndex,
        );
        subtitleSelection.current = selectedTracks.subtitleIndex;
        setSubtitleIndex(selectedTracks.subtitleIndex);
        const seriesId = target.SeriesId;
        const queue = seriesId
          ? await getEpisodes(
              seriesId,
              shuffle && shuffleSeason ? shuffleSeason : undefined,
            )
          : [];
        if (cancelled) return;
        setItem(target);
        setEpisodes(episodeQueue(queue, shuffle));
        store.setMeta({
          type: target.Type === "Episode" ? "show" : "movie",
          title: target.SeriesName ?? target.Name,
          jellyfinItemId: target.Id,
          jellyfinSeriesId: target.SeriesId,
          jellyfinGenres: target.Genres,
          jellyfinRating: target.CommunityRating,
          releaseYear: target.ProductionYear ?? 0,
          overview: target.Overview,
          logo: getImageUrl(target, "Logo", 800),
          poster: jellyfinUrl(
            `/Items/${seriesId ?? target.Id}/Images/Primary`,
            { maxWidth: 400 },
          ),
          episode:
            target.Type === "Episode"
              ? {
                  number: target.IndexNumber ?? 0,
                  title: target.Name,
                  overview: target.Overview,
                }
              : undefined,
          season:
            target.Type === "Episode"
              ? {
                  number: target.ParentIndexNumber ?? 0,
                  title: `Season ${target.ParentIndexNumber ?? 0}`,
                }
              : undefined,
        });
        await load(
          target,
          {
            ...selectedTracks,
            maxBitrate: selectedBitrate.current,
            forceTranscode: selectedBitrate.current < 120_000_000,
            mediaSourceId: source?.Id,
            defaultAudioIndex:
              source?.MediaStreams?.find(
                (track) => track.Type === "Audio" && track.IsDefault,
              )?.Index ??
              source?.MediaStreams?.find((track) => track.Type === "Audio")
                ?.Index,
            subtitleIndex:
              subtitle && !subtitle.IsTextSubtitleStream ? subtitle.Index : -1,
          },
          startAt,
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
      subtitleDownload.current?.abort();
      localPlayback(() => {
        store.display?.pause();
        store.reset();
      });
    };
  }, [
    itemId,
    restart,
    mediaSourceId,
    startTicks,
    requestedAudio,
    requestedSubtitle,
    shuffle,
    shuffleSeason,
    load,
  ]);

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
      selectedBitrate.current = 20_000_000;
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
      subtitleDownload.current?.abort();
      const request = subtitleGeneration.current;
      const track = playback.mediaSource.MediaStreams?.find(
        (stream) => stream.Type === "Subtitle" && stream.Index === index,
      );
      const wasBurnedIn = playback.subtitleIndex >= 0;
      const nextBurnedIn = track && !track.IsTextSubtitleStream;
      usePlayerStore.getState().setCaption(null);
      setSubtitleIndex(index);
      subtitleSelection.current = index;
      rememberedTracks.current = rememberTrackSelection(
        playback.mediaSource,
        playback.audioIndex,
        index,
      );
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
        const controller = new AbortController();
        subtitleDownload.current = controller;
        const srtData = await downloadCaption(caption, controller.signal);
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
      mediaSources: item?.MediaSources ?? [],
      trickplay: item?.Trickplay,
      episodes,
      itemId,
      busy,
      subtitleIndex,
      maxBitrate,
      playItem: (id: string, fromStart = false) => {
        if (selectRemoteItem(id, fromStart ? 0 : undefined)) return;
        const query = new URLSearchParams();
        if (fromStart) query.set("restart", "true");
        if (shuffle) query.set("shuffle", shuffle);
        if (shuffle && shuffleSeason) query.set("shuffleSeason", shuffleSeason);
        navigate(
          `/play/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`,
        );
      },
      changeAudio: (index: number) => {
        if (playback)
          rememberedTracks.current = rememberTrackSelection(
            playback.mediaSource,
            index,
            subtitleSelection.current,
          );
        reload({ audioIndex: index });
      },
      changeSource: (sourceId: string) => {
        const source = item?.MediaSources?.find(
          (entry) => entry.Id === sourceId,
        );
        if (!item || !source || source.Id === playback?.mediaSource.Id) return;
        const selectedTracks = getPreferredPlaybackOptions(
          source,
          configuration.current,
          rememberedTracks.current,
          item.OriginalLanguage,
        );
        const subtitle = (source as JellyfinMediaSource).MediaStreams?.find(
          (track) =>
            track.Type === "Subtitle" &&
            track.Index === selectedTracks.subtitleIndex,
        );
        subtitleGeneration.current += 1;
        subtitleSelection.current = selectedTracks.subtitleIndex;
        setSubtitleIndex(selectedTracks.subtitleIndex);
        load(
          item,
          {
            mediaSourceId: source.Id,
            audioIndex: selectedTracks.audioIndex,
            defaultAudioIndex:
              source.MediaStreams?.find(
                (track) => track.Type === "Audio" && track.IsDefault,
              )?.Index ??
              source.MediaStreams?.find((track) => track.Type === "Audio")
                ?.Index,
            subtitleIndex:
              subtitle && !subtitle.IsTextSubtitleStream ? subtitle.Index : -1,
            maxBitrate,
            forceTranscode: maxBitrate < 120_000_000,
          },
          usePlayerStore.getState().progress.time,
          true,
        );
      },
      changeSubtitle: (index: number) => {
        changeSubtitle(index);
      },
      changeQuality: (bitrate: number) => {
        selectedBitrate.current = bitrate;
        setMaxBitrate(bitrate);
        reload({
          maxBitrate: bitrate,
          forceTranscode: bitrate < 120_000_000,
        });
      },
    }),
    [
      playback,
      item,
      episodes,
      itemId,
      busy,
      subtitleIndex,
      maxBitrate,
      navigate,
      shuffle,
      shuffleSeason,
      reload,
      changeSubtitle,
      load,
    ],
  );

  return (
    <JellyfinPlaybackContext.Provider value={controls}>
      <JellyfinSyncPlayProvider
        blocked={castConnected}
        onPlayItem={(id, ticks) => {
          navigate(`/play/${encodeURIComponent(id)}?startTicks=${ticks}`);
        }}
      >
        <JellyfinChromecastProvider
          blocked={Boolean(syncGroup)}
          onCastStarted={() => {
            setCastSuspended(true);
            localPlayback(() => usePlayerStore.getState().display?.pause());
            if (playback) stopTranscode(playback).catch(() => {});
          }}
          onReturnToLocal={async (ticks, autoplay = true) => {
            if (item)
              await load(
                item,
                lastOptions.current,
                ticks / 10_000_000,
                true,
                autoplay,
              );
            setCastSuspended(false);
          }}
        >
          {playback && !casting && !castSuspended ? (
            <JellyfinSessionReporter playback={playback} />
          ) : null}
          <PlayerPart backUrl="/">
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
                              selectedBitrate.current = 20_000_000;
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
        </JellyfinChromecastProvider>
      </JellyfinSyncPlayProvider>
    </JellyfinPlaybackContext.Provider>
  );
}

export default JellyfinPlayerView;
