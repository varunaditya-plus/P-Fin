import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { enrichTasteMedia } from "@/backend/personalisation/catalog";
import { TasteMedia, TasteRating } from "@/backend/personalisation/types";
import { tasteScope, useTasteProfile, useTasteStore } from "@/stores/taste";

const options: { value: TasteRating; label: string; path: string }[] = [
  {
    value: "loved",
    label: "Love",
    path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  },
  {
    value: "liked",
    label: "Like",
    path: "M7 10v11H3V10h4Zm0 0 5-8c2 0 3 2 2 5l-1 3h6c2 0 2 1 2 3l-2 7c0 1-1 1-2 1H7",
  },
  {
    value: "disliked",
    label: "Dislike",
    path: "M7 14V3H3v11h4Zm0 0 5 8c2 0 3-2 2-5l-1-3h6c2 0 2-1 2-3l-2-7c0-1-1-1-2-1H7",
  },
  {
    value: "hated",
    label: "Hate",
    path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8ZM12 6l-2 5 4 2-2 6",
  },
];
function RatingIcon({ value }: { value?: TasteRating }) {
  return (
    <svg
      width="1.15em"
      height="1.15em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          (options.find((option) => option.value === value) ?? options[1]).path
        }
      />
    </svg>
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
