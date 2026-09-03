import { MakeSlice } from "@/stores/player/slices/types";

export interface PlayingSlice {
  mediaPlaying: {
    isPlaying: boolean;
    isPaused: boolean;
    isSeeking: boolean; // seeking with progress bar
    isDragSeeking: boolean; // is seeking for our custom progress bar
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
    isSeeking: false,
    isDragSeeking: false,
    hasPlayedOnce: false,
    volume: 1,
    playbackRate: 1,
  },
});
