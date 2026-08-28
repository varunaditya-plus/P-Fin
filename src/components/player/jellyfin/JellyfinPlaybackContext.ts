import { createContext, useContext } from "react";

import { JellyfinItem } from "@/backend/jellyfin/client";
import { JellyfinPlayback } from "@/backend/jellyfin/playback";

export interface JellyfinPlaybackControls {
  playback: JellyfinPlayback | null;
  episodes: JellyfinItem[];
  itemId: string;
  busy: boolean;
  subtitleIndex: number;
  maxBitrate: number;
  playItem: (id: string, restart?: boolean) => void;
  changeAudio: (index: number) => void;
  changeSubtitle: (index: number) => void;
  changeQuality: (bitrate: number) => void;
}

export const JellyfinPlaybackContext =
  createContext<JellyfinPlaybackControls | null>(null);

export function useJellyfinPlayback() {
  const controls = useContext(JellyfinPlaybackContext);
  if (!controls) throw new Error("Jellyfin playback controls are unavailable.");
  return controls;
}
