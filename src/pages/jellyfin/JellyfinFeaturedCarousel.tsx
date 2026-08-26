import classNames from "classnames";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useWindowSize } from "react-use";

import { JellyfinItem, getImageUrl } from "@/backend/jellyfin/client";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { usePreferencesStore } from "@/stores/preferences";

export function JellyfinFeaturedCarousel({
  items,
  onSelect,
  children,
  searching,
}: {
  items: JellyfinItem[];
  onSelect: (item: JellyfinItem) => void;
  children: ReactNode;
  searching: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const { width, height } = useWindowSize();
  const enableImageLogos = usePreferencesStore((s) => s.enableImageLogos);
  const current = items[currentIndex % Math.max(1, items.length)];

  useEffect(() => {
    if (paused || searching || items.length < 2) return;
    const interval = window.setInterval(
      () => setCurrentIndex((index) => (index + 1) % items.length),
      8000,
    );
    return () => window.clearInterval(interval);
  }, [items.length, paused, searching]);

  const move = (direction: number) =>
    setCurrentIndex(
      (index) => (index + direction + items.length) % items.length,
    );
  const searchClasses = searching
    ? "opacity-0 pointer-events-none transition-opacity duration-300"
    : "opacity-100 transition-opacity duration-300";

  return (
    <div
      className={classNames(
        "relative w-full transition-[height] duration-300 ease-in-out",
        searching
          ? "h-24"
          : height > 600
            ? "h-[40rem] md:h-[85vh]"
            : "h-[100vh]",
      )}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null || !items.length) return;
        const distance = touchStart.current - event.changedTouches[0].clientX;
        if (Math.abs(distance) > 50) move(distance > 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <div
        className={classNames(
          "relative w-full h-full overflow-hidden",
          searchClasses,
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.Id}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentIndex % items.length ? "opacity-100" : "opacity-0"}`}
            style={{
              backgroundImage: `url(${getImageUrl(item, "Backdrop", 1920)})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              maskImage:
                "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 700px)",
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 700px)",
            }}
          />
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous slide"
            className={classNames(
              "absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors",
              searchClasses,
            )}
          >
            <Icon icon={Icons.CHEVRON_LEFT} className="text-white w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next slide"
            className={classNames(
              "absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors",
              searchClasses,
            )}
          >
            <Icon icon={Icons.CHEVRON_RIGHT} className="text-white w-8 h-8" />
          </button>
        </>
      )}
      <div
        className={classNames(
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-[19] flex gap-2",
          searchClasses,
        )}
      >
        {items.map((item, index) => (
          <button
            key={item.Id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${index === currentIndex % items.length ? "bg-white scale-125" : "bg-white/50 hover:bg-white/75"}`}
          />
        ))}
      </div>
      {current && (
        <div
          className={classNames(
            "absolute inset-0 flex items-end pb-20 z-10 transition-opacity duration-150",
            searchClasses,
          )}
        >
          <div className="container mx-auto px-8 lg:px-4 flex justify-between items-end w-full">
            <div className="max-w-3xl">
              {current.ImageTags?.Logo && enableImageLogos ? (
                <img
                  src={getImageUrl(current, "Logo", 800)}
                  alt={current.Name}
                  className="max-w-[14rem] md:max-w-[22rem] max-h-[20vh] object-contain drop-shadow-lg bg-transparent mb-6"
                />
              ) : (
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                  {current.Name}
                </h1>
              )}
              <div className="flex items-center gap-2 text-sm text-white/80 mb-4">
                {current.CommunityRating ? (
                  <span>{current.CommunityRating.toFixed(1)} / 10</span>
                ) : null}
                {current.ProductionYear ? (
                  <span>• {current.ProductionYear}</span>
                ) : null}
                {current.OfficialRating ? (
                  <span>• {current.OfficialRating}</span>
                ) : null}
              </div>
              <p className="text-lg text-white mb-6 line-clamp-3 md:line-clamp-4">
                {current.Overview}
              </p>
              <div
                className="flex gap-4 justify-center items-center sm:justify-start"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                <Button
                  onClick={() => onSelect(current)}
                  theme="secondary"
                  className="w-full sm:w-auto text-base"
                >
                  <Icon icon={Icons.PLAY} className="text-white" />
                  <span className="text-white">
                    {current.UserData?.PlaybackPositionTicks
                      ? "Continue watching"
                      : "Watch now"}
                  </span>
                </Button>
                <Button
                  onClick={() => onSelect(current)}
                  theme="secondary"
                  className="w-full sm:w-auto text-base"
                >
                  <Icon
                    icon={Icons.CIRCLE_QUESTION}
                    className="text-white scale-100"
                  />
                  <span className="text-white">More info</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        className={classNames(
          "absolute inset-0 pointer-events-none",
          width > 1280 ? "pt-0" : "pt-14",
        )}
      >
        <div className="pointer-events-auto z-50">{children}</div>
      </div>
    </div>
  );
}
