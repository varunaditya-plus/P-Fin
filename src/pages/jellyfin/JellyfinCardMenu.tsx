import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  JellyfinItem,
  getEpisodes,
  setFavorite,
  setPlayed,
} from "@/backend/jellyfin/client";
import { getContentPolicy } from "@/backend/jellyfin/content";
import {
  getJellyfinDetailsId,
  getJellyfinDetailsTarget,
} from "@/backend/jellyfin/details";
import { resetResumePoint } from "@/backend/jellyfin/progress";
import { Icon, Icons } from "@/components/Icon";
import {
  ContextMenuDivider,
  ContextMenuItem,
} from "@/components/utils/ContextMenu";

export type JellyfinCardAction = "collection" | "playlist";

export function JellyfinCardMenu({
  item,
  onSelect,
  onChanged,
  close,
}: {
  item: JellyfinItem;
  onSelect: (item: JellyfinItem, action?: JellyfinCardAction) => void;
  onChanged: (data: NonNullable<JellyfinItem["UserData"]>) => void;
  close: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [confirmResumeReset, setConfirmResumeReset] = useState(false);
  const copyInput = useRef<HTMLInputElement>(null);
  const [canCollect, setCanCollect] = useState(false);
  const [canResetResume, setCanResetResume] = useState(false);
  const active = useRef(true);
  const playable = [
    "Movie",
    "Episode",
    "Video",
    "Trailer",
    "MusicVideo",
    "Series",
  ].includes(item.Type);
  const container = ["BoxSet", "Playlist", "Person"].includes(item.Type);
  const link = new URL(
    `/?item=${encodeURIComponent(getJellyfinDetailsId(item))}`,
    window.location.origin,
  ).toString();

  useEffect(() => {
    if (copyFallback) {
      copyInput.current?.focus();
      copyInput.current?.select();
    }
  }, [copyFallback]);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    if (!container)
      getContentPolicy(controller.signal)
        .then((policy) => {
          if (!controller.signal.aborted) {
            setCanCollect(
              Boolean(
                policy.IsAdministrator || policy.EnableCollectionManagement,
              ),
            );
            setCanResetResume(
              Boolean(policy.IsAdministrator) ||
                (policy as { EnableUserPreferenceAccess?: boolean })
                  .EnableUserPreferenceAccess !== false,
            );
          }
        })
        .catch(() => undefined);
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [container]);

  const action = async (perform: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await perform();
    } catch (reason) {
      if (active.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Jellyfin could not complete this action.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const play = () =>
    action(async () => {
      let target = item;
      if (item.Type === "Series") {
        const episodes = await getEpisodes(item.Id);
        const next =
          episodes.find(
            (episode) => (episode.UserData?.PlaybackPositionTicks ?? 0) > 0,
          ) ??
          episodes.find(
            (episode) =>
              !episode.UserData?.Played && episode.ParentIndexNumber !== 0,
          ) ??
          episodes[0];
        if (!next)
          throw new Error(
            "No episodes are available in your Jellyfin library.",
          );
        target = next;
      }
      if (!active.current) return;
      close();
      navigate(`/play/${encodeURIComponent(target.Id)}`);
    });
  const mutate = (kind: "favorite" | "played") =>
    action(async () => {
      const key = kind === "favorite" ? "IsFavorite" : "Played";
      const enabled = !item.UserData?.[key];
      await (kind === "favorite"
        ? setFavorite(item.Id, enabled)
        : setPlayed(item.Id, enabled));
      onChanged({ ...item.UserData, [key]: enabled });
      if (active.current) close();
    });
  const select = (intent?: JellyfinCardAction) => {
    close();
    onSelect(getJellyfinDetailsTarget(item), intent);
  };

  return (
    <>
      {playable ? (
        <ContextMenuItem disabled={busy} onClick={play}>
          <Icon icon={Icons.PLAY} className="text-lg w-5" />
          <span className="flex-1">
            {item.UserData?.PlaybackPositionTicks ? "Resume" : "Play now"}
          </span>
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem onClick={() => select()}>
        <Icon icon={Icons.CIRCLE_EXCLAMATION} className="text-lg w-5" />
        <span className="flex-1">More info</span>
      </ContextMenuItem>
      <ContextMenuDivider />
      {playable ? (
        <ContextMenuItem disabled={busy} onClick={() => mutate("played")}>
          <Icon
            icon={item.UserData?.Played ? Icons.EYE_SLASH : Icons.CHECKMARK}
            className="text-lg w-5"
          />
          <span className="flex-1">
            {item.UserData?.Played ? "Mark as unwatched" : "Mark as watched"}
          </span>
        </ContextMenuItem>
      ) : null}
      {playable &&
      canResetResume &&
      item.Type !== "Series" &&
      (item.UserData?.PlaybackPositionTicks ?? 0) > 0 ? (
        <>
          <ContextMenuItem
            disabled={busy}
            onClick={() => setConfirmResumeReset((value) => !value)}
          >
            <Icon icon={Icons.X} className="text-lg w-5" />
            <span className="flex-1">Remove from Continue Watching</span>
          </ContextMenuItem>
          {confirmResumeReset ? (
            <div className="border-y border-white/10 py-2">
              <p className="max-w-[260px] px-3 py-2 text-xs text-white/70">
                This resets the saved resume point for this{" "}
                {item.Type === "Episode" ? "episode" : "title"}. Watched status
                and play history stay unchanged.
              </p>
              <ContextMenuItem
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const data = await resetResumePoint(item.Id);
                    onChanged({
                      ...item.UserData,
                      ...data,
                      PlaybackPositionTicks: 0,
                    });
                    if (active.current) close();
                  })
                }
              >
                Reset resume point
              </ContextMenuItem>
              <ContextMenuItem
                disabled={busy}
                onClick={() => setConfirmResumeReset(false)}
              >
                Cancel reset
              </ContextMenuItem>
            </div>
          ) : null}
        </>
      ) : null}
      <ContextMenuItem disabled={busy} onClick={() => mutate("favorite")}>
        <Icon
          icon={
            item.UserData?.IsFavorite ? Icons.BOOKMARK : Icons.BOOKMARK_OUTLINE
          }
          className="text-lg w-5"
        />
        <span className="flex-1">
          {item.UserData?.IsFavorite
            ? "Remove from favourites"
            : "Add to favourites"}
        </span>
      </ContextMenuItem>
      <ContextMenuItem
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            if (active.current) setCopied(true);
          } catch {
            if (active.current) setCopyFallback(true);
          }
        }}
      >
        <Icon
          icon={copied ? Icons.CHECKMARK : Icons.LINK}
          className="text-lg w-5"
        />
        <span className="flex-1">{copied ? "Link copied" : "Copy link"}</span>
      </ContextMenuItem>
      {copyFallback ? (
        <div className="px-3 py-2">
          <input
            ref={copyInput}
            aria-label="Link to this title"
            className="w-full rounded bg-white/10 p-2 text-xs"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="mt-1 text-xs text-white/50">
            Select and copy this link.
          </p>
        </div>
      ) : null}
      {!container ? (
        <>
          <ContextMenuDivider />
          <div className="px-3 py-2 text-xs text-white/50 font-bold uppercase tracking-wider">
            Library
          </div>
          {canCollect ? (
            <ContextMenuItem onClick={() => select("collection")}>
              <Icon icon={Icons.PLUS} className="text-lg w-5" />
              <span className="flex-1">Add to collection</span>
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onClick={() => select("playlist")}>
            <Icon icon={Icons.PLUS} className="text-lg w-5" />
            <span className="flex-1">Add to playlist</span>
          </ContextMenuItem>
        </>
      ) : null}
      {busy ? (
        <p role="status" className="px-4 py-2 text-xs text-white/50">
          Working…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="max-w-[260px] px-4 py-2 text-xs text-red-400"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
