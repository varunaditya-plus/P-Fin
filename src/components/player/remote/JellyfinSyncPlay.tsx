import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useJellyfinPlayback } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { copyText } from "@/utils/copyText";

import { installPlaybackCommands, localPlayback } from "./playbackCommands";
import { JellyfinSyncPlay, SyncPlayGroup, useSyncPlayState } from "./syncplay";

const SyncContext = createContext<{
  controller: JellyfinSyncPlay;
  blocked: boolean;
} | null>(null);

export function JellyfinSyncPlayProvider({
  children,
  onPlayItem,
  blocked = false,
}: {
  children: ReactNode;
  onPlayItem: (itemId: string, startTicks: number) => void;
  blocked?: boolean;
}) {
  const session = useJellyfinAuth((state) => state.session);
  const [search] = useSearchParams();
  const router = useOverlayRouter("settings");
  const { playback } = useJellyfinPlayback();
  const invitationShown = useRef(false);
  useEffect(() => {
    if (!playback || invitationShown.current || !search.get("syncplay")) return;
    invitationShown.current = true;
    router.open("/syncplay");
  }, [playback, search, router]);
  const groupId = useSyncPlayState((state) => state.group?.GroupId);
  const [controller, setController] = useState<JellyfinSyncPlay | null>(null);
  const load = useRef(onPlayItem);
  load.current = onPlayItem;
  useEffect(() => {
    if (!session) return;
    const next = new JellyfinSyncPlay(
      {
        snapshot: () => {
          const state = usePlayerStore.getState();
          const video = document.getElementById(
            "video-element",
          ) as HTMLVideoElement | null;
          return {
            itemId: state.meta?.jellyfinItemId,
            seconds: state.progress.time,
            playing: state.mediaPlaying.isPlaying,
            ready:
              state.status === playerStatus.PLAYING &&
              Boolean(video && video.readyState >= 3 && !video.seeking),
            rate: state.mediaPlaying.playbackRate,
          };
        },
        pause: () =>
          localPlayback(() => usePlayerStore.getState().display?.pause()),
        play: () =>
          localPlayback(() => usePlayerStore.getState().display?.play()),
        seek: (time) =>
          localPlayback(() => usePlayerStore.getState().display?.setTime(time)),
        rate: (rate) =>
          usePlayerStore.getState().display?.setPlaybackRate(rate),
        load: (id, ticks) => load.current(id, ticks),
      },
      session,
    );
    setController(next);
    let endedItem = "";
    const timer = setInterval(() => {
      const video = document.getElementById(
        "video-element",
      ) as HTMLVideoElement | null;
      const key =
        useSyncPlayState.getState().queue?.Playlist[
          useSyncPlayState.getState().queue?.PlayingItemIndex ?? 0
        ]?.PlaylistItemId ?? "";
      if (video?.ended && key && key !== endedItem) {
        endedItem = key;
        next.action("NextItem");
      }
      next.tick();
    }, 500);
    return () => {
      clearInterval(timer);
      next.dispose();
    };
  }, [session]);
  useEffect(() => {
    if (!controller || !groupId) return;
    let seekTimer: ReturnType<typeof setTimeout>;
    const uninstall = installPlaybackCommands({
      selectItem: (id, ticks) => {
        controller
          .selectItem(id, ticks)
          .catch((cause: Error) =>
            useSyncPlayState.setState({ error: cause.message }),
          );
      },
      play: () => controller.action("Unpause"),
      pause: () => controller.action("Pause"),
      seek: (seconds) => {
        clearTimeout(seekTimer);
        seekTimer = setTimeout(() => controller.action("Seek", seconds), 150);
      },
    });
    return () => {
      clearTimeout(seekTimer);
      uninstall();
    };
  }, [controller, groupId]);
  const value = useMemo(
    () => (controller ? { controller, blocked } : null),
    [controller, blocked],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function SyncPlayIndicator() {
  const group = useSyncPlayState((state) => state.group);
  const router = useOverlayRouter("settings");
  if (!group) return null;
  return (
    <button
      type="button"
      onClick={() => router.navigate("/syncplay")}
      className="tabbable inline-flex items-center gap-2 rounded-full bg-video-context-background px-4 py-2 text-sm text-white transition-colors hover:bg-video-context-hoverColor"
    >
      <Icon icon={Icons.WATCH_PARTY} className="text-video-audio-set" />
      {group.GroupName}
      <span className="rounded-full bg-white/10 px-1.5 text-xs">
        {group.Participants.length}
      </span>
    </button>
  );
}

export function SyncPlaySettingsView() {
  const context = useContext(SyncContext);
  const state = useSyncPlayState();
  const { itemId, episodes } = useJellyfinPlayback();
  const router = useOverlayRouter("settings");
  const [groups, setGroups] = useState<SyncPlayGroup[]>([]);
  const [name, setName] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const invitation = new URLSearchParams(window.location.search).get(
    "syncplay",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const refresh = async () => {
    if (!context) return;
    setLoading(true);
    try {
      setGroups(await context.controller.list());
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    context?.controller
      .list()
      .then((result) => {
        if (!cancelled) {
          setGroups(result);
          setLoaded(true);
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
        cause instanceof Error ? cause.message : "SyncPlay is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink
        onClick={() => router.navigate("/")}
        rightSide={
          !state.group ? (
            <button
              type="button"
              aria-label="Refresh groups"
              disabled={busy || loading}
              onClick={() => run(refresh)}
              className="tabbable rounded p-2 text-type-secondary hover:text-white disabled:opacity-50"
            >
              <Icon
                icon={Icons.REPEAT}
                className={loading ? "animate-spin" : undefined}
              />
            </button>
          ) : null
        }
      >
        SyncPlay
      </Menu.BackLink>
      <Menu.Section className="space-y-3 pb-5">
        {state.group ? (
          <>
            <div className="rounded-lg bg-video-context-light/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-white font-medium">
                <Icon icon={Icons.WATCH_PARTY} />
                <span className="truncate">{state.group.GroupName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-type-secondary">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${state.connected ? "bg-video-audio-set" : "bg-type-danger"}`}
                />
                <span>
                  {state.connected ? state.group.State : "Reconnecting…"}
                </span>
                <span className="ml-auto tabular-nums">{state.ping} ms</span>
              </div>
            </div>
            <div className="space-y-1">
              <Menu.FieldTitle>
                Watching together ({state.group.Participants.length})
              </Menu.FieldTitle>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                {[...new Set(state.group.Participants)].map((participant) => (
                  <li
                    key={participant}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <Icon icon={Icons.USER} className="text-type-secondary" />
                    <span className="truncate">{participant}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-type-secondary">
              Play, pause and seek controls now control the group.
            </p>
            <Menu.Link
              clickable
              onClick={async () => {
                const url = new URL(
                  `/play/${encodeURIComponent(itemId)}`,
                  window.location.origin,
                );
                url.searchParams.set("syncplay", state.group!.GroupId);
                try {
                  const copied = await copyText(url.toString());
                  setCopyStatus(
                    copied
                      ? "Invite link copied."
                      : "Could not copy the invitation. Check clipboard access and try again.",
                  );
                } catch {
                  setCopyStatus(
                    "Could not copy the invitation. Check clipboard access and try again.",
                  );
                }
              }}
            >
              <Icon icon={Icons.LINK} className="mr-3" />
              Copy invite link
            </Menu.Link>
            {copyStatus ? (
              <p role="status" className="text-sm">
                {copyStatus}
              </p>
            ) : null}
            <p className="text-xs text-type-secondary">
              Guests sign in with their own Jellyfin accounts and need access to
              this title.
            </p>
            <Menu.Link
              clickable
              onClick={() => context?.controller.action("PreviousItem")}
            >
              <Icon icon={Icons.CHEVRON_LEFT} className="mr-3" />
              Previous in group queue
            </Menu.Link>
            <Menu.Link
              clickable
              onClick={() => context?.controller.action("NextItem")}
            >
              <Icon icon={Icons.CHEVRON_RIGHT} className="mr-3" />
              Next in group queue
            </Menu.Link>
            <Menu.Link
              clickable
              onClick={() => context?.controller.action("Stop")}
            >
              <Icon icon={Icons.X} className="mr-3" />
              Stop group playback
            </Menu.Link>
            <Menu.Link
              clickable
              disabled={busy}
              onClick={() => {
                if (context) run(() => context.controller.leave());
              }}
            >
              <span className="flex items-center text-type-danger">
                <Icon icon={Icons.LOGOUT} className="mr-3" />
                Leave group
              </span>
            </Menu.Link>
          </>
        ) : (
          <>
            <p className="text-sm text-type-secondary">
              Watch together with people on this Jellyfin server.
            </p>
            {context?.blocked ? (
              <p className="text-sm">
                Stop Google Cast before joining SyncPlay.
              </p>
            ) : null}
            <Menu.FieldTitle>Join a group</Menu.FieldTitle>
            {loading ? (
              <div
                role="status"
                className="flex items-center gap-2 py-3 text-sm text-type-secondary"
              >
                <Spinner className="h-4 w-4" />
                Finding groups…
              </div>
            ) : null}
            {loaded &&
            invitation &&
            !groups.some((group) => group.GroupId === invitation) ? (
              <p className="text-sm">
                The invited group is no longer available or is inaccessible to
                your account.
              </p>
            ) : null}
            {groups.map((group) => (
              <Menu.Link
                key={group.GroupId}
                clickable
                disabled={busy || context?.blocked || state.access === "None"}
                onClick={() => {
                  if (context)
                    run(() => context.controller.join(group.GroupId));
                }}
              >
                <Icon icon={Icons.WATCH_PARTY} className="mr-3 mt-1" />
                <span className="min-w-0">
                  {group.GroupName}
                  {group.GroupId === invitation ? " · Invitation" : ""}
                  <span className="block text-xs text-type-secondary">
                    {group.Participants.join(", ")}
                  </span>
                </span>
              </Menu.Link>
            ))}
            {loaded && !loading && !groups.length ? (
              <p className="text-sm text-type-secondary">
                No groups are active.
              </p>
            ) : null}
            {state.access === "None" ? (
              <p className="text-sm text-type-secondary">
                SyncPlay is unavailable for this account.
              </p>
            ) : null}
            {state.access === "CreateAndJoinGroups" ? (
              <div className="pt-3 space-y-3 border-t border-video-context-border">
                <Menu.FieldTitle>Create a group</Menu.FieldTitle>
                <input
                  aria-label="SyncPlay group name"
                  placeholder="Group name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  className="tabbable w-full rounded bg-video-context-inputBg p-3"
                />
                <Menu.Link
                  clickable
                  disabled={busy || !name.trim() || context?.blocked}
                  onClick={() => {
                    if (!context) return;
                    const index = episodes.findIndex(
                      (episode) => episode.Id === itemId,
                    );
                    const ids =
                      index >= 0
                        ? episodes.slice(index).map((episode) => episode.Id)
                        : [itemId];
                    run(() =>
                      context.controller.create(
                        name,
                        ids,
                        Math.round(
                          usePlayerStore.getState().progress.time * 10_000_000,
                        ),
                      ),
                    );
                  }}
                >
                  <Icon icon={Icons.PLUS} className="mr-3" />
                  Create group and watch this title
                </Menu.Link>
              </div>
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
