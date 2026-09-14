import { useEffect, useRef, useState } from "react";

import { matchesSettingsSession } from "@/backend/jellyfin/appSettings";
import { getHomeFeedPage } from "@/backend/jellyfin/browse";
import {
  JellyfinItem,
  getJellyfinSession,
  setFavorite,
} from "@/backend/jellyfin/client";
import { Icon, Icons } from "@/components/Icon";
import { HomeSectionSort } from "@/stores/jellyfin/browse";
import {
  HomePreferences,
  homeSectionPreferences,
} from "@/stores/jellyfin/home";

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
  onEditingChange,
  sort = "default",
}: {
  id: string;
  title: string;
  items: JellyfinItem[];
  preferences: HomePreferences;
  onSeeAll: () => void;
  onSelect: (item: JellyfinItem, action?: JellyfinCardAction) => void;
  onItemChanged: () => void;
  onEditingChange?: (editing: boolean) => void;
  sort?: HomeSectionSort;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  const [expanded, setExpanded] = useState<JellyfinItem[]>();
  const [total, setTotal] = useState<number>();
  const [removing, setRemoving] = useState<string[]>([]);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const section = homeSectionPreferences(preferences, id);
  const compact = section.density === "compact";
  // Only favourites have a removable membership in these home feeds. Library,
  // recently-added and Next Up results are never hidden or deleted by edit mode.
  const editing = id === "favorites" && section.editing;
  const limit = Math.min(199, columns * section.rows * (editing ? 2 : 1));
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
    setTotal(undefined);
    if (sort === "default" && preferences.layout !== "grid") return undefined;
    const controller = new AbortController();
    getHomeFeedPage(
      id,
      0,
      undefined,
      controller.signal,
      preferences.layout === "carousel" ? 20 : limit + 1,
      sort,
    )
      .then((page) => {
        if (!controller.signal.aborted) {
          setExpanded(page.Items);
          setTotal(page.TotalRecordCount);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, items, limit, preferences.layout, sort]);
  const visible = expanded ?? items;
  const overflow = (total ?? visible.length) > limit;
  const remove = async (item: JellyfinItem) => {
    if (id !== "favorites" || removing.includes(item.Id)) return;
    const session = getJellyfinSession();
    setRemoving((current) => [...current, item.Id]);
    setError("");
    try {
      await setFavorite(item.Id, false);
      if (matchesSettingsSession(session)) onItemChanged();
    } catch (reason) {
      if (mounted.current && matchesSettingsSession(session))
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to remove this favourite.",
        );
    } finally {
      if (mounted.current)
        setRemoving((current) => current.filter((value) => value !== item.Id));
    }
  };
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
        <div className="flex items-center gap-3">
          {id === "favorites" && onEditingChange ? (
            <button
              type="button"
              aria-pressed={editing}
              className="tabbable rounded-lg p-2 text-type-link"
              onClick={() => onEditingChange(!editing)}
            >
              {editing ? "Done editing" : "Edit favourites"}
            </button>
          ) : null}
          <button
            type="button"
            className="text-type-link whitespace-nowrap tabbable rounded-lg p-2"
            onClick={onSeeAll}
          >
            See all
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mb-4">
          {error}
        </p>
      ) : null}
      <div
        ref={holder}
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visible.slice(0, overflow ? limit - 1 : limit).map((item) => (
          <div key={item.Id} className="relative min-w-0">
            <JellyfinMediaCard
              item={item}
              onSelect={onSelect}
              onItemChanged={onItemChanged}
            />
            {editing ? (
              <button
                type="button"
                disabled={removing.includes(item.Id)}
                aria-label={`Remove ${item.Name} from favourites`}
                className="tabbable absolute right-2 top-2 z-10 rounded-full bg-buttons-danger p-3 text-white disabled:opacity-50"
                onClick={() => remove(item)}
              >
                <Icon icon={Icons.X} />
              </button>
            ) : null}
          </div>
        ))}
        {overflow ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="tabbable flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-background-secondary px-4 text-center text-type-link hover:bg-search-hoverBackground"
          >
            <Icon icon={Icons.PLUS} className="text-2xl" />
            <span>See all {title.toLowerCase()}</span>
            {total !== undefined ? (
              <span className="text-xs text-type-secondary">
                {total} titles
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </section>
  );
}
