import { useEffect, useRef, useState } from "react";

import { JellyfinItem, getImageUrl } from "@/backend/jellyfin/client";
import {
  getContainerPresentation,
  libraryDragType,
} from "@/backend/jellyfin/collections";
import { getJellyfinDetailsTarget } from "@/backend/jellyfin/details";
import { SeriesLengthItem } from "@/backend/jellyfin/seriesLength";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CarouselNavButtons } from "@/pages/discover/components/CarouselNavButtons";
import { MediaItem } from "@/utils/mediaTypes";

import { JellyfinCardAction, JellyfinCardMenu } from "./JellyfinCardMenu";

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
  onItemChanged,
}: {
  item: JellyfinItem;
  onSelect: (item: JellyfinItem, action?: JellyfinCardAction) => void;
  onItemChanged?: () => void;
}) {
  const [userData, setUserData] = useState(item.UserData);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [presentation, setPresentation] = useState<{
    count: number;
    items: JellyfinItem[];
  }>();
  const containerType =
    item.Type === "BoxSet" || item.Type === "Playlist" ? item.Type : undefined;
  useEffect(() => {
    if (!containerType || !holder.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [containerType]);
  useEffect(() => {
    if (
      !containerType ||
      !visible ||
      (item.ChildCount !== undefined && item.ImageTags?.Primary)
    )
      return undefined;
    const controller = new AbortController();
    getContainerPresentation(containerType, item.Id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPresentation(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [
    containerType,
    item.Id,
    item.ChildCount,
    item.ImageTags?.Primary,
    visible,
  ]);
  const count = item.ChildCount ?? presentation?.count;
  const artwork = !item.ImageTags?.Primary
    ? (presentation?.items
        .map((child) => getImageUrl(child, "Primary", 240))
        .filter(Boolean) ?? [])
    : [];
  const seriesLength = item as SeriesLengthItem;
  const seriesHours = Math.round(
    (seriesLength.TotalSeriesRunTimeTicks ?? 0) / 36000000000,
  );

  useEffect(() => setUserData(item.UserData), [item.UserData]);
  const currentItem = { ...item, UserData: userData };
  const position = userData?.PlaybackPositionTicks ?? 0;
  return (
    <div
      ref={holder}
      draggable={!containerType}
      onDragStart={(event) => {
        event.dataTransfer.setData(libraryDragType, JSON.stringify([item.Id]));
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <MediaCard
        linkable
        posterContent={
          artwork.length ? (
            <div
              className={`grid h-full ${artwork.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {[...new Set(artwork)].map((image) => (
                <img
                  key={image}
                  src={image}
                  alt=""
                  className="h-full min-h-0 w-full object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : undefined
        }
        kindLabel={
          item.Type === "BoxSet"
            ? `Collection${count !== undefined ? ` · ${count} titles` : ""}`
            : item.Type === "Playlist"
              ? `Playlist${count !== undefined ? ` · ${count} items` : ""}`
              : seriesLength.AvailableEpisodeCount !== undefined
                ? `${seriesLength.AvailableEpisodeCount} episodes${(seriesLength.TotalSeriesRunTimeTicks ?? 0) > 0 ? ` · ${seriesHours || "<1"}h` : ""}`
                : undefined
        }
        media={jellyfinMediaItem(item)}
        percentage={
          position && item.RunTimeTicks
            ? Math.min(100, (position / item.RunTimeTicks) * 100)
            : item.Type === "Series" && (userData?.PlayedPercentage ?? 0) > 0
              ? userData?.PlayedPercentage
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
        onShowDetails={() => onSelect(getJellyfinDetailsTarget(currentItem))}
        renderContextMenu={(close) => (
          <JellyfinCardMenu
            item={currentItem}
            onSelect={onSelect}
            close={close}
            onChanged={(data) => {
              setUserData(data);
              onItemChanged?.();
            }}
          />
        )}
      />
    </div>
  );
}

export function JellyfinMediaCarousel({
  id,
  title,
  items,
  loading,
  onSelect,
  onItemChanged,
  onSeeAll,
  compact,
}: {
  id: string;
  title: string;
  items: JellyfinItem[];
  loading?: boolean;
  onSelect: (item: JellyfinItem, action?: JellyfinCardAction) => void;
  onItemChanged?: () => void;
  onSeeAll?: () => void;
  compact?: boolean;
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
        {onSeeAll ? (
          <button
            type="button"
            className="mr-4 lg:mr-[100px] rounded-lg p-2 text-type-link tabbable whitespace-nowrap"
            onClick={onSeeAll}
          >
            See all
          </button>
        ) : null}
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
            : items.map((item, index) => (
                <div
                  key={
                    (item as JellyfinItem & { PlaylistItemId?: string })
                      .PlaylistItemId ?? `${item.Id}-${index}`
                  }
                  className={`relative mt-4 group cursor-pointer user-select-none rounded-xl p-2 bg-transparent transition-colors duration-300 ${compact ? "w-[8rem] md:w-[9rem]" : "w-[10rem] md:w-[11.5rem]"} h-auto`}
                >
                  <JellyfinMediaCard
                    item={item}
                    onSelect={onSelect}
                    onItemChanged={onItemChanged}
                  />
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
