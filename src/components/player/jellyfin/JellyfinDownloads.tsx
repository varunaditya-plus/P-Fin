import { useEffect, useState } from "react";

import {
  ContentItem,
  ContentPolicy,
  getContentItem,
  getContentPolicy,
} from "@/backend/jellyfin/content";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { DownloadPanel } from "@/pages/jellyfin/ContentDownloadModal";

import { useJellyfinPlayback } from "./JellyfinPlaybackContext";

export function JellyfinDownloads() {
  const router = useOverlayRouter("settings");
  const { itemId, playback, subtitleIndex } = useJellyfinPlayback();
  const [data, setData] = useState<{
    item: ContentItem;
    policy: ContentPolicy;
  }>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setData(undefined);
    setError("");
    Promise.all([
      getContentItem(itemId, request.signal),
      getContentPolicy(request.signal),
    ])
      .then(([item, policy]) => {
        if (!request.signal.aborted) setData({ item, policy });
      })
      .catch((cause) => {
        if (!request.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load downloads.",
          );
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [itemId, refresh]);
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink
        onClick={() => router.navigate("/")}
        rightSide={
          <button
            type="button"
            aria-label="Refresh downloads"
            title="Refresh"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className="-mr-2 -my-1 px-2 p-[0.4em] rounded tabbable hover:bg-video-context-light/10 text-video-context-type-secondary hover:text-video-context-type-main transition-colors disabled:opacity-50"
          >
            <Icon icon={Icons.REPEAT} className="text-lg" />
          </button>
        }
      >
        Download
      </Menu.BackLink>
      <Menu.Section className="pb-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-type-danger">
            {error}
          </p>
        ) : null}
        {data ? (
          <DownloadPanel
            key={`${data.item.Id}-${playback?.mediaSource.Id}-${refresh}`}
            item={data.item}
            policy={data.policy}
            sourceId={playback?.mediaSource.Id}
            subtitleIndex={subtitleIndex}
          />
        ) : null}
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
