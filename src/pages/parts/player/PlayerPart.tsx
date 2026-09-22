import { ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandPill } from "@/components/layout/BrandPill";
import { Player } from "@/components/player";
import { PlaybackEnhancements } from "@/components/player/enhancements/PlaybackEnhancements";
import { useShouldShowControls } from "@/components/player/hooks/useShouldShowControls";
import { GamepadEvents } from "@/components/player/jellyfin/GamepadEvents";
import {
  JellyfinBookmarkButton,
  JellyfinEpisodesRouter,
  JellyfinInfoButton,
  JellyfinNextEpisode,
  JellyfinSettingsRouter,
} from "@/components/player/jellyfin/JellyfinControls";
import { PauseOverlay } from "@/components/player/overlays/PauseOverlay";
import { useChromecastState } from "@/components/player/remote/chromecast";
import {
  CastReceiverStatus,
  ChromecastIndicator,
  JellyfinChromecastButton,
} from "@/components/player/remote/JellyfinChromecast";
import { SyncPlayIndicator } from "@/components/player/remote/JellyfinSyncPlay";
import { SubtitleAutoSyncRuntime } from "@/components/player/subtitleTools/AutoSync";
import { useIsMobile } from "@/hooks/useIsMobile";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";

export interface PlayerPartProps {
  children?: ReactNode;
  backUrl: string;
  onLoad?: () => void;
  localPlaybackSuspended?: boolean;
}

export function PlayerPart(props: PlayerPartProps) {
  const casting = useChromecastState((state) => state.casting);
  const suspended = casting || Boolean(props.localPlaybackSuspended);
  const { showTargets, showTouchTargets } = useShouldShowControls();
  const status = usePlayerStore((s) => s.status);
  const { isMobile } = useIsMobile();
  const isLoading = usePlayerStore((s) => s.mediaPlaying.isLoading);
  const { t } = useTranslation();
  const meta = usePlayerStore((s) => s.meta);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = window.matchMedia("(display-mode: standalone)").matches;

  const [isShifting, setIsShifting] = useState(false);
  const [isHoldingFullscreen, setIsHoldingFullscreen] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Shift") setIsShifting(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Shift") setIsShifting(false);
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  const handleTouchStart = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingFullscreen(true);
    }, 100);
  };

  const handleTouchEnd = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingFullscreen(false);
    }, 1000);
  };

  return (
    <Player.Container
      onLoad={props.onLoad}
      showingControls={showTargets}
      localPlaybackSuspended={suspended}
    >
      {props.children}
      <div className="absolute top-20 inset-x-4 flex justify-center gap-2 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <ChromecastIndicator />
          <SyncPlayIndicator />
        </div>
      </div>
      {casting ? <CastReceiverStatus /> : null}
      {!suspended ? (
        <>
          <GamepadEvents />
          <PlaybackEnhancements />
          <SubtitleAutoSyncRuntime />
          <PauseOverlay />
        </>
      ) : null}
      <Player.BlackOverlay
        show={showTargets && status === playerStatus.PLAYING}
      />
      <JellyfinEpisodesRouter />
      <JellyfinSettingsRouter />
      {!suspended ? <Player.SubtitleView controlsShown={showTargets} /> : null}

      {status === playerStatus.PLAYING ? (
        <Player.CenterControls>
          <Player.LoadingSpinner />
          <Player.AutoPlayStart />
        </Player.CenterControls>
      ) : null}

      <Player.CenterMobileControls
        className="text-white"
        show={showTouchTargets && status === playerStatus.PLAYING}
      >
        <Player.SkipBackward iconSizeClass="text-3xl" />
        <Player.Pause
          iconSizeClass="text-5xl"
          className={isLoading ? "opacity-0" : "opacity-100"}
        />
        <Player.SkipForward iconSizeClass="text-3xl" />
      </Player.CenterMobileControls>

      <Player.TopControls show={showTargets}>
        <div className="grid grid-cols-[1fr,auto] xl:grid-cols-3 items-center">
          <div className="flex space-x-3 items-center">
            <Player.BackLink url={props.backUrl} />
            <span className="text mx-3 text-type-secondary">/</span>
            <Player.Title />

            {isMobile && meta?.type === "show" && (
              <span className="text-type-secondary text-sm whitespace-nowrap flex-shrink-0">
                {t("media.episodeDisplay", {
                  season: meta?.season?.number,
                  episode: meta?.episode?.number,
                })}
              </span>
            )}

            <JellyfinInfoButton />
            <JellyfinBookmarkButton />
          </div>
          <div className="text-center hidden xl:flex justify-center items-center">
            <Player.EpisodeTitle />
          </div>
          <div className="hidden lg:flex items-center justify-end">
            <BrandPill />
          </div>
          <div className="flex lg:hidden items-center justify-end">
            {status === playerStatus.PLAYING ? (
              <>
                <JellyfinChromecastButton />
                <Player.Airplay />
              </>
            ) : null}
          </div>
        </div>
      </Player.TopControls>

      <Player.BottomControls show={showTargets}>
        <div className="flex items-center justify-center space-x-3 h-full">
          {status === playerStatus.PLAYING ? (
            <>
              {isMobile ? <Player.Time short /> : null}
              <Player.ProgressBar />
            </>
          ) : null}
        </div>
        <div className="hidden lg:flex justify-between" dir="ltr">
          <Player.LeftSideControls>
            {status === playerStatus.PLAYING ? (
              <>
                <Player.Pause />
                <Player.SkipBackward />
                <Player.SkipForward />
                <Player.Volume />
                <Player.Time />
              </>
            ) : null}
          </Player.LeftSideControls>
          <div className="flex items-center space-x-3">
            <Player.Episodes />
            <JellyfinNextEpisode compact controlsShowing={showTargets} />
            {status === playerStatus.PLAYING ? (
              <>
                <Player.Pip />
                <JellyfinChromecastButton />
                <Player.Airplay />
              </>
            ) : null}
            {status === playerStatus.PLAYBACK_ERROR ||
            status === playerStatus.PLAYING ? (
              <Player.Captions />
            ) : null}
            <Player.Settings />
            {isShifting || isHoldingFullscreen ? (
              <Player.Widescreen />
            ) : (
              <Player.Fullscreen />
            )}
          </div>
        </div>
        <div className="grid grid-cols-[2.5rem,1fr,2.5rem] gap-3 lg:hidden">
          <div />
          <div className="flex justify-center space-x-3">
            {/* Disable PiP for iOS PWA */}
            {!(isPWA && isIOS) && status === playerStatus.PLAYING && (
              <Player.Pip />
            )}
            <Player.Episodes />
            {status === playerStatus.PLAYING ? (
              <div className="hidden ssm:block">
                <Player.Captions />
              </div>
            ) : null}
            <Player.Settings />
          </div>
          <div>
            {status === playerStatus.PLAYING && (
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="select-none touch-none"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {isHoldingFullscreen ? (
                  <Player.Widescreen />
                ) : (
                  <Player.Fullscreen />
                )}
              </div>
            )}
          </div>
        </div>
      </Player.BottomControls>

      <Player.VolumeChangedPopout />
      <Player.SubtitleDelayPopout />
      <Player.SpeedChangedPopout />
      <JellyfinNextEpisode controlsShowing={showTargets} />
    </Player.Container>
  );
}
