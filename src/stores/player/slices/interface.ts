import { DisplayError } from "@/components/player/display/displayInterface";
import { MakeSlice } from "@/stores/player/slices/types";

export enum VideoPlayerTimeFormat {
  REGULAR = 0,
  REMAINING = 1,
}

export enum PlayerHoverState {
  NOT_HOVERING = "not_hovering",
  MOUSE_HOVER = "mouse_hover",
  MOBILE_TAPPED = "mobile_tapped",
}

export interface InterfaceSlice {
  interface: {
    isFullscreen: boolean;
    isSeeking: boolean;
    lastVolume: number;
    hasOpenOverlay: boolean;
    hovering: PlayerHoverState;
    lastHoveringState: PlayerHoverState;
    canAirplay: boolean;
    error?: DisplayError;

    leftControlHovering: boolean; // is the cursor hovered over the left side of player controls
    isHoveringControls: boolean; // is the cursor hovered over any controls?
    timeFormat: VideoPlayerTimeFormat; // Time format of the video player
    isSpeedBoosted: boolean; // is playback speed temporarily boosted to 2x
    showSpeedIndicator: boolean; // should the speed indicator be shown
  };
  updateInterfaceHovering(newState: PlayerHoverState): void;
  setSeeking(seeking: boolean): void;
  setTimeFormat(format: VideoPlayerTimeFormat): void;
  setHoveringLeftControls(state: boolean): void;
  setHoveringAnyControls(state: boolean): void;
  setHasOpenOverlay(state: boolean): void;
  setLastVolume(state: number): void;
  setSpeedBoosted(state: boolean): void;
  setShowSpeedIndicator(state: boolean): void;
}

export const createInterfaceSlice: MakeSlice<InterfaceSlice> = (set, get) => ({
  interface: {
    hasOpenOverlay: false,
    isFullscreen: false,
    isSeeking: false,
    lastVolume: 0,
    leftControlHovering: false,
    isHoveringControls: false,
    hovering: PlayerHoverState.NOT_HOVERING,
    lastHoveringState: PlayerHoverState.NOT_HOVERING,
    timeFormat: VideoPlayerTimeFormat.REGULAR,
    canAirplay: false,
    isSpeedBoosted: false,
    showSpeedIndicator: false,
  },

  setLastVolume(state) {
    set((s) => {
      s.interface.lastVolume = state;
    });
  },
  setHasOpenOverlay(state) {
    set((s) => {
      s.interface.hasOpenOverlay = state;
    });
  },
  setTimeFormat(format) {
    set((s) => {
      s.interface.timeFormat = format;
    });
  },
  updateInterfaceHovering(newState: PlayerHoverState) {
    set((s) => {
      if (newState !== PlayerHoverState.NOT_HOVERING)
        s.interface.lastHoveringState = newState;
      s.interface.hovering = newState;
    });
  },
  setSeeking(seeking) {
    const display = get().display;
    display?.setSeeking(seeking);
    set((s) => {
      s.interface.isSeeking = seeking;
    });
  },
  setHoveringLeftControls(state) {
    set((s) => {
      s.interface.leftControlHovering = state;
    });
  },
  setHoveringAnyControls(state) {
    set((s) => {
      s.interface.isHoveringControls = state;
    });
  },
  setSpeedBoosted(state) {
    set((s) => {
      s.interface.isSpeedBoosted = state;
    });
  },
  setShowSpeedIndicator(state) {
    set((s) => {
      s.interface.showSpeedIndicator = state;
    });
  },
});
