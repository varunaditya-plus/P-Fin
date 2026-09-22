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

import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { VideoPlayerButton } from "@/components/player/internals/Button";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useJellyfinPlayback } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePlayerStore } from "@/stores/player/store";

import { castReturnTarget } from "./castPlayback";
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
  onReturnToLocal: (
    positionTicks: number,
    autoplay?: boolean,
    itemId?: string,
  ) => Promise<void>;
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
  const lastRemote = useRef({
    itemId: playback?.itemId ?? "",
    positionTicks: 0,
  });
  const localCallback = useRef(onReturnToLocal);
  localCallback.current = onReturnToLocal;
  const wasCasting = useRef(false);
  useEffect(
    () =>
      useChromecastState.subscribe((state) => {
        lastRemote.current = castReturnTarget(state.state, lastRemote.current);
      }),
    [],
  );
  useEffect(() => {
    if (wasCasting.current && !casting && !returning.current)
      localCallback
        .current(
          lastRemote.current.positionTicks,
          false,
          lastRemote.current.itemId,
        )
        .catch(() => {});
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
    lastRemote.current = {
      itemId: playback.itemId,
      positionTicks: Math.round(state.progress.time * 10_000_000),
    };
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
      const target = castReturnTarget(
        useChromecastState.getState().state,
        lastRemote.current,
      );
      if (!controller) return;
      returning.current = true;
      wasCasting.current = false;
      try {
        await controller.disconnect(true);
        await onReturnToLocal(target.positionTicks, autoplay, target.itemId);
      } catch (error) {
        wasCasting.current = useChromecastState.getState().casting;
        throw error;
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

export function JellyfinChromecastButton() {
  const context = useContext(CastContext);
  const state = useChromecastState();
  const router = useOverlayRouter("settings");
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    if (
      !window.isSecureContext ||
      !/Chrome|Chromium|Edg\//.test(navigator.userAgent)
    )
      return;
    context?.controller.initialize().catch(() => {});
  }, [context?.controller]);
  if (!context || (!state.available && !state.connected)) return null;
  return (
    <VideoPlayerButton
      icon={Icons.CASTING}
      label={
        connecting
          ? "Connecting to Google Cast"
          : state.casting
            ? `Casting to ${state.receiver}`
            : "Cast to a device"
      }
      className={
        connecting
          ? "animate-pulse"
          : state.error
            ? "text-video-scraping-error"
            : state.casting
              ? "text-video-audio-set"
              : undefined
      }
      onClick={() => {
        if (connecting) return;
        if (state.casting || context.blocked) {
          router.open("/cast");
          return;
        }
        setConnecting(true);
        context
          .start()
          .catch((cause) => {
            useChromecastState.setState({
              error:
                cause instanceof Error
                  ? cause.message
                  : "Google Cast is unavailable.",
            });
            router.open("/cast");
          })
          .finally(() => setConnecting(false));
      }}
    />
  );
}

export function CastReceiverStatus() {
  const receiver = useChromecastState((state) => state.receiver);
  const remote = useChromecastState((state) => state.state);
  const settings = useOverlayRouter("settings");
  return (
    <div className="absolute inset-0 z-40 bg-background-main flex flex-col items-center justify-center gap-5 px-6 text-center text-white">
      <Icon icon={Icons.CASTING} className="text-5xl text-video-audio-set" />
      <div className="space-y-2">
        <p className="text-xl font-semibold">{receiver || "Google Cast"}</p>
        <p className="text-type-secondary">
          {remote?.NowPlayingItem?.Name || "Playing on your cast receiver"}
        </p>
        <p className="text-sm text-type-secondary">
          {remote?.PlayState?.IsPaused ? "Paused" : "Playing"}
        </p>
      </div>
      <button
        type="button"
        className="tabbable rounded-lg bg-video-context-light/10 px-5 py-3 hover:bg-video-context-light/20 transition-colors"
        onClick={() => settings.open("/cast")}
      >
        Open cast controls
      </button>
    </div>
  );
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
      className="tabbable inline-flex items-center gap-2 rounded-full bg-video-context-background px-4 py-2 text-sm text-white hover:bg-video-context-hoverColor transition-colors"
    >
      <Icon icon={Icons.CASTING} className="text-video-audio-set" />
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
            <div className="rounded-lg bg-video-context-light/5 p-3 space-y-2">
              <div className="flex items-center gap-2 font-medium text-white">
                <Icon icon={Icons.CASTING} className="text-video-audio-set" />
                <span className="truncate">{state.receiver}</span>
              </div>
              <p className="text-sm text-type-secondary truncate">
                {remote?.NowPlayingItem?.Name ?? "Playing on your receiver"}
              </p>
              <p className="text-xs text-type-secondary flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-video-audio-set" />
                {remote?.PlayState?.IsPaused ? "Paused" : "Playing"}
                <span className="ml-auto tabular-nums">
                  {Math.floor(position / 60)}:
                  {String(position % 60).padStart(2, "0")}
                </span>
              </p>
            </div>
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
              <Icon
                icon={remote?.PlayState?.IsPaused ? Icons.PLAY : Icons.PAUSE}
                className="mr-3"
              />
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
                <div key={kind} className="space-y-1">
                  <Menu.FieldTitle>
                    {kind === "Subtitle" ? "Subtitles" : "Audio"}
                  </Menu.FieldTitle>
                  <Dropdown
                    className="!my-0 !w-full !max-w-none"
                    selectedItem={{
                      id: String(
                        (kind === "Audio"
                          ? remote?.PlayState?.AudioStreamIndex
                          : remote?.PlayState?.SubtitleStreamIndex) ?? -1,
                      ),
                      name:
                        streams.find(
                          (stream) =>
                            stream.Type === kind &&
                            stream.Index ===
                              (kind === "Audio"
                                ? remote?.PlayState?.AudioStreamIndex
                                : remote?.PlayState?.SubtitleStreamIndex),
                        )?.DisplayTitle ??
                        (kind === "Subtitle" ? "Off" : "Default"),
                    }}
                    options={[
                      ...(kind === "Subtitle"
                        ? [{ id: "-1", name: "Off" }]
                        : []),
                      ...streams
                        .filter((stream) => stream.Type === kind)
                        .map((stream) => ({
                          id: String(stream.Index),
                          name:
                            stream.DisplayTitle ?? `${kind} ${stream.Index}`,
                        })),
                    ]}
                    setSelectedItem={({ id }) => {
                      if (context)
                        run(() =>
                          context.controller.command(`Set${kind}StreamIndex`, {
                            index: Number(id),
                          }),
                        );
                    }}
                  />
                </div>
              ) : null,
            )}
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context) run(() => context.returnToLocal());
              }}
            >
              <Icon icon={Icons.PLAY} className="mr-3" />
              Play on this device
            </Menu.Link>
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context) run(() => context.returnToLocal(false));
              }}
            >
              <Icon icon={Icons.X} className="mr-3" />
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
              <Icon
                icon={Icons.CASTING}
                className={`mr-3 ${busy ? "animate-pulse" : ""}`}
              />
              {busy
                ? "Waiting for receiver…"
                : state.initialized
                  ? "Choose a receiver"
                  : "Loading Google Cast…"}
            </Menu.Link>
            {state.connected ? (
              <Menu.Link
                clickable
                disabled={busy || !context}
                onClick={() => {
                  if (context) run(() => context.controller.disconnect(false));
                }}
              >
                Disconnect receiver
              </Menu.Link>
            ) : null}
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
