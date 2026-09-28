import { MakeSlice } from "@/stores/player/slices/types";

export interface PlayingSlice {
  mediaPlaying: {
    isPlaying: boolean;
    isPaused: boolean;
    isLoading: boolean; // buffering or not
    hasPlayedOnce: boolean; // has the video played at all?
    volume: number;
    playbackRate: number;
  };
}

export const createPlayingSlice: MakeSlice<PlayingSlice> = () => ({
  mediaPlaying: {
    isPlaying: false,
    isPaused: true,
    isLoading: false,
    hasPlayedOnce: false,
    volume: 1,
    playbackRate: 1,
  },
});
