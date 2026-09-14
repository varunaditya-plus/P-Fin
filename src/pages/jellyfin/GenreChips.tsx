import { useId, useLayoutEffect, useRef, useState } from "react";

import { Icon, Icons } from "@/components/Icon";

import { GenreIcon } from "./GenreIcon";

import "./genreChips.css";

const INITIAL_GENRES = 5;

export function GenreChips({
  genres,
  onSelect,
}: {
  genres: string[];
  onSelect: (genre: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(0);
  const additional = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = additional.current;
    if (!element) return undefined;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [genres]);
  if (!genres.length) return null;
  const chip = (genre: string, index: number, extra = false) => (
    <button
      type="button"
      key={genre}
      className="genre-chip tabbable flex shrink-0 items-center gap-1.5 rounded-full border border-white/5 bg-search-background/40 px-3.5 py-2 text-xs font-medium tracking-wide text-type-secondary backdrop-blur-md hover:border-white/15 hover:bg-search-hoverBackground/80 hover:text-white"
      onClick={() => onSelect(genre)}
      tabIndex={extra && !expanded ? -1 : undefined}
      style={
        extra
          ? {
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateY(0)" : "translateY(-6px)",
              transitionDelay: expanded
                ? `${Math.min(index, 8) * 25}ms`
                : "0ms",
            }
          : undefined
      }
    >
      <GenreIcon genre={genre} />
      {genre}
    </button>
  );
  return (
    <div className="genre-chips w-full" role="group" aria-label="Browse genres">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-2 scrollbar-none sm:justify-center">
          {genres
            .slice(0, INITIAL_GENRES)
            .map((genre, index) => chip(genre, index))}
        </div>
        {genres.length > INITIAL_GENRES ? (
          <button
            type="button"
            aria-controls={id}
            aria-expanded={expanded}
            className="genre-chip tabbable flex shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-search-background/60 px-3.5 py-2 text-xs font-medium text-type-secondary hover:border-white/60 hover:text-white"
            onClick={() => setExpanded((value) => !value)}
          >
            <Icon icon={expanded ? Icons.CHEVRON_UP : Icons.PLUS} />
            {expanded ? "Fewer genres" : "More genres"}
          </button>
        ) : null}
      </div>
      <div
        id={id}
        aria-hidden={!expanded}
        className="genre-chips-expansion overflow-hidden"
        style={{
          height: expanded ? height : 0,
          pointerEvents: expanded ? undefined : "none",
        }}
      >
        <div
          ref={additional}
          className="flex flex-wrap justify-center gap-2 p-2"
        >
          {genres
            .slice(INITIAL_GENRES)
            .map((genre, index) => chip(genre, index, true))}
        </div>
      </div>
    </div>
  );
}
