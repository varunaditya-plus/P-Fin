import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useShouldShowControls } from "@/components/player/hooks/useShouldShowControls";
import { useIsMobile } from "@/hooks/useIsMobile";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

export function PauseOverlay() {
  const isPaused = usePlayerStore((state) => state.mediaPlaying.isPaused);
  const hasPlayed = usePlayerStore((state) => state.mediaPlaying.hasPlayedOnce);
  const isLoading = usePlayerStore((state) => state.mediaPlaying.isLoading);
  const status = usePlayerStore((state) => state.status);
  const meta = usePlayerStore((state) => state.meta);
  const { duration, draggingTime } = usePlayerStore((state) => state.progress);
  const seeking = usePlayerStore((state) => state.interface.isSeeking);
  const enabled = usePreferencesStore((state) => state.enablePauseOverlay);
  const imageLogos = usePreferencesStore((state) => state.enableImageLogos);
  const { isMobile } = useIsMobile();
  const { showTargets } = useShouldShowControls();
  const { t } = useTranslation();
  const [visibleItem, setVisibleItem] = useState<string | null>(null);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const itemId = meta?.jellyfinItemId;
  const canShow =
    enabled &&
    hasPlayed &&
    isPaused &&
    !isLoading &&
    !seeking &&
    draggingTime <= 0 &&
    status === playerStatus.PLAYING;
  useEffect(() => {
    setVisibleItem(null);
    if (!canShow || !itemId) return;
    const timer = setTimeout(() => setVisibleItem(itemId), 1000);
    return () => clearTimeout(timer);
  }, [canShow, itemId]);
  if (!meta) return null;
  const visible =
    canShow && visibleItem === itemId && !(isMobile && showTargets);
  const overview =
    meta.type === "show"
      ? (meta.episode?.overview ?? meta.overview)
      : meta.overview;
  const logo =
    imageLogos && meta.logo && failedLogo !== meta.logo ? meta.logo : null;
  const rating = meta.jellyfinRating;
  const genres = meta.jellyfinGenres ?? [];
  const minutes =
    Number.isFinite(duration) && duration > 0 ? Math.round(duration / 60) : 0;
  const episodeTitle = meta.episode?.title
    ?.replace(/^(?:Episode\s*\d+\s*[-:]?\s*)+/i, "")
    .trim();
  return (
    <div
      aria-hidden={!visible}
      data-pause-overlay
      className={`absolute inset-0 z-[15] flex flex-col justify-between bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none pointer-events-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="flex-1 flex items-end pb-20 sm:pb-24"
        style={{
          paddingBottom:
            "max(calc(var(--player-controls-height, 5rem) + 1.25rem), 5.5rem)",
        }}
      >
        <div
          className={
            isMobile
              ? "ml-4 max-w-[85%]"
              : "ml-6 md:ml-8 lg:ml-12 max-w-lg lg:max-w-2xl"
          }
        >
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-white/90 mb-2 w-fit border border-white/10 shadow-sm">
            {t("player.pauseOverlay.youAreWatching", "You are watching")}
          </div>
          {logo ? (
            <img
              src={logo}
              alt={meta.title}
              onError={() => setFailedLogo(logo)}
              className={`object-contain object-left mr-auto drop-shadow-2xl ${isMobile ? "mb-1.5 max-h-16 max-w-[85%]" : "mb-3 max-h-24 lg:max-h-32 max-w-[80%]"}`}
            />
          ) : (
            <h1
              className={`font-extrabold text-white drop-shadow-2xl leading-tight tracking-tight ${isMobile ? "mb-1 text-xl sm:text-2xl line-clamp-2" : "mb-2 text-3xl sm:text-4xl lg:text-5xl line-clamp-2"}`}
            >
              {meta.title}
            </h1>
          )}
          {meta.type === "show" && meta.season && meta.episode ? (
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-white/80 font-medium ${isMobile ? "text-xs mb-1" : "text-sm mb-1.5"}`}
            >
              <span className="font-semibold text-white/95">
                {t("media.episodeDisplay", {
                  season: meta.season.number,
                  episode: meta.episode.number,
                })}
              </span>
              {episodeTitle ? (
                <>
                  <span className="text-white/40">•</span>
                  <span className="text-white font-medium line-clamp-1">
                    {episodeTitle}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
          {overview ? (
            <p
              className={`text-white/75 drop-shadow-md leading-relaxed ${isMobile ? "text-xs line-clamp-2 mb-1.5 max-w-sm" : "text-sm sm:text-base line-clamp-3 mb-3 max-w-xl text-white/80"}`}
            >
              {overview}
            </p>
          ) : null}
          <div
            className={`flex flex-wrap items-center gap-2 font-medium text-white/85 ${isMobile ? "text-xs" : "text-sm"}`}
          >
            {rating !== undefined && Number.isFinite(rating) && rating > 0 ? (
              <span
                aria-label={`Jellyfin rating ${rating.toFixed(1)} out of 10`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-amber-300"
                  aria-hidden="true"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {rating.toFixed(1)}
              </span>
            ) : null}
            {minutes > 0 ? (
              <span>
                {minutes >= 60
                  ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
                  : `${minutes}m`}
              </span>
            ) : null}
            {genres.length && !isMobile ? (
              <>
                <span className="text-white/40">•</span>
                <span className="text-white/70">
                  {genres.slice(0, 3).join(", ")}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
