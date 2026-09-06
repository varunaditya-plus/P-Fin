import { useEffect } from "react";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";

import { usePlaybackEnhancements } from "./preferences";

let boostRequest = 0;
export async function applyAudioBoost(
  display: DisplayInterface,
  percent: number,
) {
  boostRequest += 1;
  const request = boostRequest;
  const item = usePlaybackEnhancements.getState().activeItem;
  try {
    await display.setVolumeBoost(percent / 100);
    if (
      request === boostRequest &&
      item === usePlaybackEnhancements.getState().activeItem
    )
      usePlaybackEnhancements.getState().reportBoost(percent);
  } catch (error) {
    if (
      request === boostRequest &&
      item === usePlaybackEnhancements.getState().activeItem
    )
      usePlaybackEnhancements
        .getState()
        .reportBoost(
          100,
          error instanceof Error
            ? error.message
            : "Volume boost is unavailable.",
        );
  }
}

export function PlaybackEnhancements() {
  const display = usePlayerStore((state) => state.display);
  const status = usePlayerStore((state) => state.status);
  const isPlaying = usePlayerStore((state) => state.mediaPlaying.isPlaying);
  const itemId = usePlayerStore((state) => state.meta?.jellyfinItemId);
  const seriesId = usePlayerStore((state) => state.meta?.jellyfinSeriesId);
  const session = useJellyfinAuth((state) => state.session);
  const picture = usePlaybackEnhancements((state) => state.picture);
  const boost = usePlaybackEnhancements((state) => state.boost);
  const activeItem = usePlaybackEnhancements((state) => state.activeItem);
  const titleKey =
    itemId && session
      ? JSON.stringify([
          session.serverId ?? session.serverAddress ?? session.serverUrl,
          session.userId,
          seriesId ?? itemId,
        ])
      : null;
  useEffect(() => {
    usePlaybackEnhancements.getState().bindPlayback(itemId ?? null, titleKey);
  }, [itemId, titleKey]);
  useEffect(() => {
    display?.setVideoAppearance(picture);
  }, [display, picture]);
  useEffect(() => {
    if (!display || activeItem !== itemId || status !== playerStatus.PLAYING)
      return;
    applyAudioBoost(display, boost);
  }, [display, status, boost, itemId, activeItem, isPlaying]);
  useEffect(
    () => () => {
      boostRequest += 1;
      usePlaybackEnhancements.getState().bindPlayback(null, null);
    },
    [],
  );
  return null;
}
