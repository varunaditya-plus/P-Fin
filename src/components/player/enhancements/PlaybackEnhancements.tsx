import { useEffect } from "react";

import { usePlayerStore } from "@/stores/player/store";

import { usePlaybackEnhancements } from "./preferences";

export function PlaybackEnhancements() {
  const display = usePlayerStore((state) => state.display);
  const picture = usePlaybackEnhancements((state) => state.picture);
  useEffect(() => {
    display?.setVideoAppearance(picture);
  }, [display, picture]);
  return null;
}
