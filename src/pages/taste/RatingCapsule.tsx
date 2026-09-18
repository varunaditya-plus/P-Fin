import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { enrichTasteMedia } from "@/backend/personalisation/catalog";
import { TasteMedia, TasteRating } from "@/backend/personalisation/types";
import { Icon, Icons } from "@/components/Icon";
import { tasteScope, useTasteProfile, useTasteStore } from "@/stores/taste";

const options: { value: TasteRating; label: string; icon: Icons }[] = [
  { value: "loved", label: "Love it", icon: Icons.HEART },
  { value: "liked", label: "Like", icon: Icons.THUMBS_UP },
  { value: "disliked", label: "Dislike", icon: Icons.THUMBS_DOWN },
  { value: "hated", label: "Hate it", icon: Icons.HEART_CRACK },
];
function RatingIcon({ value }: { value?: TasteRating }) {
  return (
    <Icon
      icon={
        (options.find((option) => option.value === value) ?? options[1]).icon
      }
    />
  );
}
export function RatingCapsule({ media }: { media: TasteMedia }) {
  const profile = useTasteProfile();
  const rating = profile.ratings[media.key]?.rating;
  const rate = useTasteStore((state) => state.rate);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(195);
  const chooseRating = async (value: TasteRating) => {
    if (saving) return;
    const scope = tasteScope();
    setSaving(true);
    const enriched = await enrichTasteMedia(media).catch(() => media);
    if (scope === tasteScope()) rate(enriched, value);
    setSaving(false);
    setExpanded(false);
    trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (row.current) setWidth(row.current.scrollWidth || 195);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node))
        setExpanded(false);
    };
    document.addEventListener("pointerdown", outside);
    row.current
      ?.querySelector<HTMLButtonElement>(`[data-rating="${rating ?? "loved"}"]`)
      ?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded, rating]);
  return (
    <div
      ref={container}
      className="relative flex h-12 shrink-0 items-center overflow-hidden rounded-full bg-buttons-secondary transition-[width,transform] duration-300 ease-out motion-reduce:transition-none"
      style={{ width: expanded ? width : "3rem" }}
      onKeyDown={(event) => {
        if (expanded && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setExpanded(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setExpanded(false);
      }}
    >
      <div
        ref={row}
        role="group"
        aria-label={`Rate ${media.title}`}
        className="flex h-12 w-max"
      >
        {options.map((option, index) => (
          <div key={option.value} className="flex items-center">
            {index ? (
              <span
                className={`h-6 w-px bg-white/20 transition-opacity duration-150 ${expanded ? "opacity-100 delay-150" : "opacity-0"}`}
              />
            ) : null}
            <button
              type="button"
              disabled={saving}
              data-rating={option.value}
              aria-label={`${option.label} ${media.title}`}
              aria-pressed={rating === option.value}
              title={option.label}
              tabIndex={expanded ? 0 : -1}
              onClick={(event) => {
                event.stopPropagation();
                chooseRating(option.value);
              }}
              className={`tabbable flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[opacity,color,transform] duration-200 hover:scale-110 motion-reduce:transition-none ${expanded ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"} ${rating === option.value ? (option.value === "loved" || option.value === "hated" ? "text-red-400" : "text-white") : "text-white/70"}`}
            >
              <RatingIcon value={option.value} />
            </button>
          </div>
        ))}
      </div>
      <button
        ref={trigger}
        type="button"
        aria-label={`Your rating for ${media.title}: ${rating ?? "not rated"}. Change rating`}
        aria-expanded={expanded}
        tabIndex={expanded ? -1 : 0}
        onClick={(event) => {
          event.stopPropagation();
          setExpanded(true);
        }}
        className={`tabbable absolute inset-y-0 left-0 flex h-12 w-12 items-center justify-center rounded-full bg-pill-background transition-opacity duration-150 ${expanded ? "opacity-0 pointer-events-none" : "opacity-100 hover:scale-110"} ${rating === "loved" || rating === "hated" ? "text-red-400" : "text-white/80"}`}
      >
        <RatingIcon value={rating} />
      </button>
    </div>
  );
}
