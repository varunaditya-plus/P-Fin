import { DisplayInterface } from "@/components/player/display/displayInterface";

import { CastPlaybackState } from "./chromecast";
import { localPlayback } from "./playbackCommands";

export function castReturnTarget(
  remote: CastPlaybackState | null,
  fallback: { itemId: string; positionTicks: number },
) {
  const itemId =
    remote?.ItemId ?? remote?.NowPlayingItem?.Id ?? fallback.itemId;
  const ticks = remote?.PlayState?.PositionTicks;
  return {
    itemId,
    positionTicks:
      typeof ticks === "number" && Number.isFinite(ticks)
        ? Math.max(0, ticks)
        : itemId === fallback.itemId
          ? fallback.positionTicks
          : 0,
  };
}

export function suspendLocalCastPlayback(display: DisplayInterface | null) {
  if (!display) return;
  localPlayback(() => {
    display.pause();
    // Releasing the source stops HLS segment requests and native/PiP playback.
    // A fresh Jellyfin playback session is loaded explicitly when returning.
    display.load({
      source: null,
      startAt: 0,
      autoplay: false,
      automaticQuality: false,
      preferredQuality: null,
    });
  });
}
export function allowLocalPlaybackRecovery(
  casting: boolean,
  suspended: boolean,
) {
  return !casting && !suspended;
}
