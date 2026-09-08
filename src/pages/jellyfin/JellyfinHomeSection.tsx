import { useEffect, useRef, useState } from "react";

import { getHomeFeedPage } from "@/backend/jellyfin/browse";
import { JellyfinItem } from "@/backend/jellyfin/client";
import { HomeSectionSort } from "@/stores/jellyfin/browse";
import { HomePreferences } from "@/stores/jellyfin/home";

import { JellyfinCardAction } from "./JellyfinCardMenu";
import {
  JellyfinMediaCard,
  JellyfinMediaCarousel,
} from "./JellyfinMediaCarousel";

export function JellyfinHomeSection({
  id,
  title,
  items,
  preferences,
  onSeeAll,
  onSelect,
  onItemChanged,
  sort = "default",
}: {
  id: string;
  title: string;
  items: JellyfinItem[];
  preferences: HomePreferences;
  onSeeAll: () => void;
  onSelect: (item: JellyfinItem, action?: JellyfinCardAction) => void;
  onItemChanged: () => void;
  sort?: HomeSectionSort;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  const [expanded, setExpanded] = useState<JellyfinItem[]>();
  const compact = preferences.density === "compact";
  const limit = columns * preferences.rows;
  useEffect(() => {
    if (!holder.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(
        Math.max(
          2,
          Math.floor((entry.contentRect.width + 16) / (compact ? 144 : 184)),
        ),
      );
    });
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [compact, preferences.layout]);
  useEffect(() => {
    setExpanded(undefined);
    if (
      sort === "default" &&
      (preferences.layout !== "grid" || limit <= items.length)
    )
      return undefined;
    const controller = new AbortController();
    getHomeFeedPage(
      id,
      0,
      undefined,
      controller.signal,
      preferences.layout === "carousel" ? 20 : limit,
      sort,
    )
      .then((page) => {
        if (!controller.signal.aborted) setExpanded(page.Items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, items, limit, preferences.layout, sort]);
  const visible = expanded ?? items;
  if (preferences.layout === "carousel")
    return (
      <JellyfinMediaCarousel
        id={id}
        title={title}
        items={visible}
        onSelect={onSelect}
        onItemChanged={onItemChanged}
        onSeeAll={onSeeAll}
        compact={compact}
      />
    );
  return (
    <section className="px-4 lg:px-[100px] py-4" aria-label={title}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <button
          type="button"
          className="text-type-link whitespace-nowrap tabbable rounded-lg p-2"
          onClick={onSeeAll}
        >
          See all
        </button>
      </div>
      <div
        ref={holder}
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visible.slice(0, limit).map((item) => (
          <JellyfinMediaCard
            key={item.Id}
            item={item}
            onSelect={onSelect}
            onItemChanged={onItemChanged}
          />
        ))}
      </div>
    </section>
  );
}
