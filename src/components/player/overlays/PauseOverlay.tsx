import { useTranslation } from "react-i18next";
import { useIdle } from "react-use";

import { useShouldShowControls } from "@/components/player/hooks/useShouldShowControls";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { durationExceedsHour, formatSeconds } from "@/utils/formatSeconds";
import { uses12HourClock } from "@/utils/uses12HourClock";

export function PauseOverlay() {
  const isIdle = useIdle(5e3); // 5 seconds
  const isPaused = usePlayerStore((s) => s.mediaPlaying.isPaused);
  const meta = usePlayerStore((s) => s.meta);
  const { time, duration, draggingTime } = usePlayerStore((s) => s.progress);
  const { isSeeking } = usePlayerStore((s) => s.interface);
  const playbackRate = usePlayerStore((s) => s.mediaPlaying.playbackRate);
  const enablePauseOverlay = usePreferencesStore((s) => s.enablePauseOverlay);
  const { isMobile } = useIsMobile();
  const { showTargets } = useShouldShowControls();
  const { t } = useTranslation();
  const details = {
    voteAverage: meta?.jellyfinRating ?? null,
    genres: meta?.jellyfinGenres ?? [],
  };
  const shouldShow =
    isPaused && isIdle && enablePauseOverlay && !(isMobile && showTargets);

  if (!meta) return null;

  const overview =
    meta.type === "show" ? meta.episode?.overview : meta.overview;

  const hasHours = durationExceedsHour(duration);
  const currentTime = Math.min(
    Math.max(isSeeking ? draggingTime : time, 0),
    duration,
  );
  const secondsRemaining = Math.abs(currentTime - duration);
  const secondsRemainingAdjusted =
    playbackRate > 0 ? secondsRemaining / playbackRate : secondsRemaining;

  const timeLeft = formatSeconds(
    secondsRemaining,
    durationExceedsHour(secondsRemaining),
  );
  const timeWatched = formatSeconds(currentTime, hasHours);
  const timeFinished = new Date(Date.now() + secondsRemainingAdjusted * 1e3);
  const durationFormatted = formatSeconds(duration, hasHours);

  const localizationKey = "remaining";

  // Don't render anything if we don't have content, but keep structure for fade if valid
  const hasDetails = details.voteAverage !== null || details.genres.length > 0;
  const hasContent = overview || meta.title || hasDetails;
  if (!hasContent) return null;

  return (
    <div
      className={`absolute inset-0 z-[60] flex items-center bg-black/60 transition-opacity duration-500 pointer-events-none ${
        shouldShow ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="md:ml-16 max-w-md lg:max-w-2xl p-8">
        <h1 className="mb-4 text-4xl font-bold text-white drop-shadow-lg">
          {meta.title}
        </h1>

        {meta.type === "show" && meta.episode && (
          <h2 className="mb-2 text-2xl font-semibold text-white/90 drop-shadow-md">
            {meta.episode.title}
          </h2>
        )}

        {(details.voteAverage !== null ||
          details.genres.length > 0 ||
          duration > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80 drop-shadow-md">
            {details.voteAverage !== null && (
              <span>
                {details.voteAverage.toFixed(1)}
                <span className="text-white/60 ml-0.5">/10</span>
              </span>
            )}
            {details.genres.length > 0 && (
              <>
                {details.voteAverage !== null && (
                  <span className="text-white/60">•</span>
                )}
                <span>{details.genres.slice(0, 4).join(", ")}</span>
              </>
            )}
            {duration > 0 && (
              <>
                {(details.voteAverage !== null ||
                  details.genres.length > 0) && (
                  <span className="text-white/60">•</span>
                )}
                <span>
                  {(() => {
                    const text = t(`player.time.${localizationKey}`, {
                      timeFinished,
                      timeWatched,
                      timeLeft,
                      duration: durationFormatted,
                      formatParams: {
                        timeFinished: {
                          hour: "numeric",
                          minute: "numeric",
                          hour12: uses12HourClock(),
                        },
                      },
                    });
                    if (
                      localizationKey === "remaining" &&
                      text.includes(" • ")
                    ) {
                      const [left, right] = text.split(" • ");
                      return (
                        <>
                          {left}
                          <span className="text-white/60 mx-1">•</span>
                          {right}
                        </>
                      );
                    }
                    return text;
                  })()}
                </span>
              </>
            )}
          </div>
        )}

        {overview && (
          <p className="text-lg text-white/80 drop-shadow-md line-clamp-6">
            {overview}
          </p>
        )}
      </div>
    </div>
  );
}
