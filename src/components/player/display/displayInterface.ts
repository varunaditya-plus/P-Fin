import { VideoAppearance } from "@/components/player/display/videoAppearance";
import { LoadableSource, SourceQuality } from "@/stores/player/utils/qualities";
import { Listener } from "@/utils/events";

export type DisplayErrorType = "hls" | "htmlvideo" | "global";
export type DisplayError = {
  stackTrace?: string;
  message?: string;
  key?: string;
  errorName: string;
  type: DisplayErrorType;
  hls?: {
    details: string;
    fatal: boolean;
    level?: number;
    levelDetails?: {
      url: string;
      width: number;
      height: number;
      bitrate: number;
    };
    frag?: {
      url: string;
      baseurl: string;
      duration: number;
      start: number;
      sn: number | string;
    };
    type: string;
    url?: string;
  };
};

export type DisplayInterfaceEvents = {
  play: void;
  pause: void;
  fullscreen: boolean;
  volumechange: number;
  time: number;
  duration: number;
  buffered: number;
  loading: boolean;
  qualities: SourceQuality[];
  changedquality: SourceQuality | null;
  needstrack: boolean;
  canairplay: boolean;
  playbackrate: number;
  error: DisplayError;
};

export interface qualityChangeOptions {
  autoplay?: boolean;
  source: LoadableSource | null;
  automaticQuality: boolean;
  preferredQuality: SourceQuality | null;
  startAt: number;
}

export interface DisplayInterface extends Listener<DisplayInterfaceEvents> {
  play(): void;
  pause(): void;
  load(ops: qualityChangeOptions): void;
  processVideoElement(video: HTMLVideoElement): void;
  processContainerElement(container: HTMLElement): void;
  toggleFullscreen(): void;
  togglePictureInPicture(): void;
  setSeeking(active: boolean): void;
  setVolume(vol: number): void;
  setVideoAppearance(appearance: VideoAppearance): void;
  setTime(t: number): void;
  destroy(): void;
  startAirplay(): void;
  setPlaybackRate(rate: number): void;
}
