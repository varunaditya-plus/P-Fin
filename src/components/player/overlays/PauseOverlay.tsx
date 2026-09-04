import { CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon, Icons } from "@/components/Icon";
import { useShouldShowControls } from "@/components/player/hooks/useShouldShowControls";
import { useIsMobile } from "@/hooks/useIsMobile";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { durationExceedsHour, formatSeconds } from "@/utils/formatSeconds";

export function PauseOverlay() {
  const isPaused = usePlayerStore((s) => s.mediaPlaying.isPaused);
  const hasPlayed = usePlayerStore((s) => s.mediaPlaying.hasPlayedOnce);
  const isLoading = usePlayerStore((s) => s.mediaPlaying.isLoading);
  const status = usePlayerStore((s) => s.status);
  const meta = usePlayerStore((s) => s.meta);
  const { time, duration } = usePlayerStore((s) => s.progress);
  const enablePauseOverlay = usePreferencesStore((s) => s.enablePauseOverlay);
  const { isMobile } = useIsMobile();
  const { showTargets } = useShouldShowControls();
  const { t } = useTranslation();
  const [visibleItem, setVisibleItem] = useState<string | null>(null);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const itemId = meta?.jellyfinItemId;
  const canShow =
    enablePauseOverlay &&
    hasPlayed &&
    isPaused &&
    !isLoading &&
    status === playerStatus.PLAYING;

  useEffect(() => {
    setVisibleItem(null);
    if (!canShow || !itemId) return;
    const timer = setTimeout(() => setVisibleItem(itemId), 2000);
    return () => clearTimeout(timer);
  }, [canShow, itemId]);

  if (!meta) return null;
  const shouldShow =
    canShow && visibleItem === itemId && !(isMobile && showTargets);
  const overview =
    meta.type === "show" ? meta.episode?.overview : meta.overview;
  const rating = meta.jellyfinRating;
  const genres = meta.jellyfinGenres ?? [];
  const runtime = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const remaining = Math.max(0, runtime - Math.max(0, time));
  const logo = meta.logo && failedLogo !== meta.logo ? meta.logo : null;
  const stagger = `transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none ${shouldShow ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`;
  const delay = (index: number): CSSProperties => ({
    transitionDelay: shouldShow ? `${index * 80}ms` : "0ms",
  });

  return (
    <div
      aria-hidden={!shouldShow}
      data-pause-overlay
      className={`absolute inset-0 z-[60] flex flex-col justify-between transition-opacity duration-700 motion-reduce:transition-none pointer-events-none ${shouldShow ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 70%, transparent 30%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <div className="relative flex-1 flex items-end pb-32 md:pb-44 px-8 md:px-20 lg:px-32">
        <div className="max-w-xl lg:max-w-2xl min-w-0">
          <div
            className={`flex items-center gap-3 mb-5 ${stagger}`}
            style={delay(0)}
          >
            <span className="h-2 w-2 rounded-full bg-video-context-type-accent" />
            <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-white/80">
              {t("player.pauseOverlay.youAreWatching", "Now playing")}
            </span>
          </div>
          <div className={`mb-4 ${stagger}`} style={delay(1)}>
            {logo ? (
              <img
                src={logo}
                alt={meta.title}
                className="max-h-28 lg:max-h-36 max-w-full object-contain object-left drop-shadow-lg"
                onError={() => setFailedLogo(logo)}
              />
            ) : (
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white leading-tight drop-shadow-lg [text-wrap:balance]">
                {meta.title}
              </h1>
            )}
          </div>
          {meta.type === "show" && meta.season && meta.episode ? (
            <div className={`mb-3 ${stagger}`} style={delay(2)}>
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold text-white/90 bg-white/10 ring-1 ring-white/15">
                {t("media.episodeDisplay", {
                  season: meta.season.number,
                  episode: meta.episode.number,
                })}
              </span>
            </div>
          ) : null}
          {meta.type === "show" && meta.episode?.title ? (
            <h2
              className={`mb-4 text-xl lg:text-3xl font-semibold text-white/95 drop-shadow-md ${stagger}`}
              style={delay(3)}
            >
              {meta.episode.title}
            </h2>
          ) : null}
          {overview ? (
            <p
              className={`text-sm lg:text-base text-white/70 leading-relaxed line-clamp-3 mb-5 max-w-xl drop-shadow-md ${stagger}`}
              style={delay(4)}
            >
              {overview}
            </p>
          ) : null}
          <div
            className={`flex flex-wrap items-center gap-2 ${stagger}`}
            style={delay(5)}
          >
            {rating !== undefined && Number.isFinite(rating) && rating > 0 ? (
              <span className="px-2.5 py-1 rounded-full text-xs text-white/90 bg-white/10 ring-1 ring-white/15">
                {rating.toFixed(1)} / 10
              </span>
            ) : null}
            {runtime > 0 ? (
              <span className="px-2.5 py-1 rounded-full text-xs text-white/90 bg-white/10 ring-1 ring-white/15">
                {formatSeconds(runtime, durationExceedsHour(runtime))}
              </span>
            ) : null}
            {genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 rounded-full text-xs text-white/85 bg-white/5 ring-1 ring-white/10"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`absolute bottom-20 right-8 md:right-14 flex flex-col items-end gap-2 ${stagger}`}
        style={delay(6)}
      >
        <div className="flex items-center gap-3 text-white/70">
          <Icon icon={Icons.PAUSE} className="text-xl" />
          <span className="text-xl md:text-3xl font-light tracking-[0.25em] uppercase">
            {t("player.pauseOverlay.paused", "Paused")}
          </span>
        </div>
        {runtime > 0 ? (
          <span className="text-xs text-white/60">
            {t("player.pauseOverlay.remaining", {
              defaultValue: "{{time}} remaining",
              time: formatSeconds(remaining, durationExceedsHour(remaining)),
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
