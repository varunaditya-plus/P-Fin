import { useRef } from "react";

import { JellyfinItem, getImageUrl } from "@/backend/jellyfin/client";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CarouselNavButtons } from "@/pages/discover/components/CarouselNavButtons";
import { MediaItem } from "@/utils/mediaTypes";

export function jellyfinMediaItem(item: JellyfinItem): MediaItem {
  return {
    id: item.Id,
    title: item.Type === "Episode" ? item.SeriesName || item.Name : item.Name,
    poster: getImageUrl(
      item.Type === "Episode" && item.SeriesId && item.SeriesPrimaryImageTag
        ? {
            Id: item.SeriesId,
            Name: item.SeriesName || item.Name,
            Type: "Series",
            ImageTags: { Primary: item.SeriesPrimaryImageTag },
          }
        : item,
      "Primary",
      400,
    ),
    type: item.Type === "Movie" ? "movie" : "show",
    year: item.ProductionYear,
    // A library item is available even when its release metadata is missing.
    release_date: new Date(0),
  };
}

export function JellyfinMediaCard({
  item,
  onSelect,
}: {
  item: JellyfinItem;
  onSelect: (item: JellyfinItem) => void;
}) {
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  return (
    <MediaCard
      linkable
      hideBookmark
      media={jellyfinMediaItem(item)}
      percentage={
        position && item.RunTimeTicks
          ? Math.min(100, (position / item.RunTimeTicks) * 100)
          : undefined
      }
      series={
        item.Type === "Episode"
          ? {
              episode: item.IndexNumber ?? 1,
              season: item.ParentIndexNumber,
              episodeId: item.Id,
              seasonId: item.SeasonId || "",
            }
          : undefined
      }
      onShowDetails={() => onSelect(item)}
    />
  );
}

export function JellyfinMediaCarousel({
  id,
  title,
  items,
  loading,
  onSelect,
}: {
  id: string;
  title: string;
  items: JellyfinItem[];
  loading?: boolean;
  onSelect: (item: JellyfinItem) => void;
}) {
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { isMobile } = useIsMobile();
  if (!loading && !items.length) return null;

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between ml-2 md:ml-8 mt-2">
        <div className="flex flex-col pl-2 lg:pl-[68px]">
          <h2 className="text-2xl cursor-default font-bold text-white md:text-2xl pl-0 text-balance">
            {title}
          </h2>
        </div>
      </div>
      <div className="relative overflow-hidden carousel-container md:pb-4">
        <div
          className="grid grid-flow-col auto-cols-max gap-4 pt-0 overflow-x-scroll scrollbar-none rounded-xl overflow-y-hidden md:pl-8 md:pr-8"
          ref={(element) => {
            carouselRefs.current[id] = element;
          }}
        >
          <div className="lg:w-12" />
          {loading
            ? Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  className="relative mt-4 group user-select-none rounded-xl p-2 bg-transparent w-[10rem] md:w-[11.5rem] h-auto"
                >
                  <MediaCardSkeleton />
                </div>
              ))
            : items.map((item) => (
                <div
                  key={item.Id}
                  className="relative mt-4 group cursor-pointer user-select-none rounded-xl p-2 bg-transparent transition-colors duration-300 w-[10rem] md:w-[11.5rem] h-auto"
                >
                  <JellyfinMediaCard item={item} onSelect={onSelect} />
                </div>
              ))}
          <div className="lg:w-12" />
        </div>
        {!isMobile && !loading && (
          <CarouselNavButtons categorySlug={id} carouselRefs={carouselRefs} />
        )}
      </div>
    </section>
  );
}
