import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Menu } from "@/components/player/internals/ContextMenu";
import { useJellyfinPlayback } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePlayerStore } from "@/stores/player/store";

import { JellyfinChromecast, useChromecastState } from "./chromecast";

const CastContext = createContext<{
  controller: JellyfinChromecast;
  start: () => Promise<void>;
  returnToLocal: (autoplay?: boolean) => Promise<void>;
  blocked: boolean;
} | null>(null);

export function JellyfinChromecastProvider({
  children,
  onCastStarted,
  onReturnToLocal,
  blocked = false,
}: {
  children: ReactNode;
  onCastStarted: () => void;
  onReturnToLocal: (positionTicks: number, autoplay?: boolean) => Promise<void>;
  blocked?: boolean;
}) {
  const session = useJellyfinAuth((state) => state.session);
  const { playback, subtitleIndex, maxBitrate } = useJellyfinPlayback();
  const [controller, setController] = useState<JellyfinChromecast | null>(null);
  useEffect(() => {
    if (!session) return;
    const current = new JellyfinChromecast(session);
    setController(current);
    return () => current.dispose();
  }, [session]);
  const casting = useChromecastState((state) => state.casting);
  const returning = useRef(false);
  const lastRemoteTicks = useRef(0);
  const localCallback = useRef(onReturnToLocal);
  localCallback.current = onReturnToLocal;
  const wasCasting = useRef(false);
  useEffect(
    () =>
      useChromecastState.subscribe((state) => {
        const ticks = state.state?.PlayState?.PositionTicks;
        if (ticks !== undefined) lastRemoteTicks.current = ticks;
      }),
    [],
  );
  useEffect(() => {
    if (wasCasting.current && !casting && !returning.current)
      localCallback.current(lastRemoteTicks.current, false).catch(() => {});
    wasCasting.current = casting;
  }, [casting]);
  const callback = useRef(onCastStarted);
  callback.current = onCastStarted;
  useEffect(() => {
    if (casting) callback.current();
  }, [casting]);

  const start = useCallback(async () => {
    if (blocked) throw new Error("Leave SyncPlay before starting Google Cast.");
    if (!playback || !controller)
      throw new Error("Wait for the title to load before casting.");
    const state = usePlayerStore.getState();
    if (!state.meta) return;
    await controller.connect();
    await controller.play({
      item: {
        Id: playback.itemId,
        Name: state.meta.episode?.title ?? state.meta.title,
        Type: state.meta.type === "show" ? "Episode" : "Movie",
      },
      positionTicks: Math.round(state.progress.time * 10_000_000),
      mediaSourceId: playback.mediaSource.Id,
      audioIndex: playback.audioIndex,
      subtitleIndex,
      maxBitrate,
    });
  }, [blocked, controller, playback, subtitleIndex, maxBitrate]);
  const returnToLocal = useCallback(
    async (autoplay = true) => {
      const position =
        useChromecastState.getState().state?.PlayState?.PositionTicks ??
        Math.round(usePlayerStore.getState().progress.time * 10_000_000);
      if (!controller) return;
      returning.current = true;
      try {
        await controller.disconnect(true);
        await onReturnToLocal(position, autoplay);
      } finally {
        returning.current = false;
      }
    },
    [controller, onReturnToLocal],
  );
  const value = useMemo(
    () => (controller ? { controller, start, returnToLocal, blocked } : null),
    [controller, start, returnToLocal, blocked],
  );
  return <CastContext.Provider value={value}>{children}</CastContext.Provider>;
}

export function ChromecastIndicator() {
  const casting = useChromecastState((state) => state.casting);
  const receiver = useChromecastState((state) => state.receiver);
  const router = useOverlayRouter("settings");
  if (!casting) return null;
  return (
    <button
      type="button"
      onClick={() => router.navigate("/cast")}
      className="tabbable rounded-full bg-video-context-background px-4 py-2 text-sm text-white"
    >
      Casting to {receiver}
    </button>
  );
}

export function ChromecastSettingsView() {
  const context = useContext(CastContext);
  const router = useOverlayRouter("settings");
  const state = useChromecastState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seek, setSeek] = useState("");
  useEffect(() => {
    let cancelled = false;
    context?.controller.initialize().catch((cause: Error) => {
      if (!cancelled) setError(cause.message);
    });
    return () => {
      cancelled = true;
    };
  }, [context?.controller]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Google Cast is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remote = state.state;
  const streams = remote?.NowPlayingItem?.MediaStreams ?? [];
  const position = Math.max(
    0,
    Math.floor((remote?.PlayState?.PositionTicks ?? 0) / 10_000_000),
  );
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/")}>
        Google Cast
      </Menu.BackLink>
      <Menu.Section className="space-y-3 pb-5">
        {state.casting ? (
          <>
            <p className="font-medium text-white">{state.receiver}</p>
            <p className="text-sm text-type-secondary">
              {remote?.NowPlayingItem?.Name ?? "Playing on your receiver"} ·{" "}
              {Math.floor(position / 60)}:
              {String(position % 60).padStart(2, "0")}
            </p>
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context)
                  run(() =>
                    context.controller.command(
                      remote?.PlayState?.IsPaused ? "Unpause" : "Pause",
                    ),
                  );
              }}
            >
              {remote?.PlayState?.IsPaused ? "Resume" : "Pause"}
            </Menu.Link>
            <div className="flex gap-2 items-center">
              <input
                aria-label="Seek to seconds"
                placeholder="Seconds"
                value={seek}
                onChange={(event) => setSeek(event.target.value)}
                type="number"
                min={0}
                className="tabbable min-w-0 w-full rounded bg-video-context-inputBg px-3 py-2"
              />
              <button
                type="button"
                disabled={
                  busy || !seek.trim() || !Number.isFinite(Number(seek))
                }
                className="tabbable px-3 py-2 rounded bg-video-context-light/10 disabled:opacity-50"
                onClick={() => {
                  if (context)
                    run(() =>
                      context.controller.command("Seek", {
                        position: Math.max(0, Number(seek)),
                      }),
                    );
                }}
              >
                Seek
              </button>
            </div>
            <label className="block text-sm">
              Receiver volume
              <input
                aria-label="Receiver volume"
                type="range"
                min={0}
                max={100}
                value={remote?.PlayState?.VolumeLevel ?? 100}
                onChange={(event) => {
                  if (context)
                    run(() =>
                      context.controller.setVolume(
                        Number(event.target.value) / 100,
                      ),
                    );
                }}
                className="mt-2 w-full accent-video-context-light"
              />
            </label>
            {(["Audio", "Subtitle"] as const).map((kind) =>
              streams.some((stream) => stream.Type === kind) ? (
                <label key={kind} className="block text-sm">
                  {kind === "Subtitle" ? "Subtitles" : "Audio"}
                  <select
                    aria-label={`Cast ${kind.toLowerCase()}`}
                    className="tabbable w-full rounded bg-video-context-inputBg p-2 mt-2"
                    value={
                      (kind === "Audio"
                        ? remote?.PlayState?.AudioStreamIndex
                        : remote?.PlayState?.SubtitleStreamIndex) ?? -1
                    }
                    onChange={(event) => {
                      if (context)
                        run(() =>
                          context.controller.command(`Set${kind}StreamIndex`, {
                            index: Number(event.target.value),
                          }),
                        );
                    }}
                  >
                    {kind === "Subtitle" ? (
                      <option value={-1}>Off</option>
                    ) : null}
                    {streams
                      .filter((stream) => stream.Type === kind)
                      .map((stream) => (
                        <option key={stream.Index} value={stream.Index}>
                          {stream.DisplayTitle ?? `${kind} ${stream.Index}`}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null,
            )}
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context) run(() => context.returnToLocal());
              }}
            >
              Play on this device
            </Menu.Link>
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context) run(() => context.returnToLocal(false));
              }}
            >
              Stop casting
            </Menu.Link>
          </>
        ) : (
          <>
            <p className="text-sm text-type-secondary">
              Send this title directly from Jellyfin to a Google Cast receiver.
              The receiver must be able to reach your Jellyfin server.
            </p>
            <Menu.Link
              clickable
              disabled={
                busy || !state.initialized || !context || context.blocked
              }
              onClick={() => {
                if (context) run(context.start);
              }}
            >
              {busy
                ? "Waiting for receiver…"
                : state.initialized
                  ? "Choose a receiver"
                  : "Loading Google Cast…"}
            </Menu.Link>
            {context?.blocked ? (
              <p className="text-sm">Leave SyncPlay before casting.</p>
            ) : null}
          </>
        )}
        {error || state.error ? (
          <p role="alert" className="text-sm text-type-danger">
            {error || state.error}
          </p>
        ) : null}
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
