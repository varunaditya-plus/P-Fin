import { useEffect, useMemo, useState } from "react";

import { buildTasteAffinities } from "@/backend/personalisation/engine";
import { GENRES } from "@/backend/personalisation/types";
import { useTasteProfile } from "@/stores/taste";

const colors = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
];
const colorFor = (genre: string) =>
  colors[Math.max(0, GENRES.indexOf(genre)) % colors.length];
function mixedColor(first: string, last: string) {
  const parts = [first, last].map((value) =>
    [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16)),
  );
  return `rgb(${parts[0].map((value, index) => Math.round((value + parts[1][index]) / 2)).join(", ")})`;
}
export function GenreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const target = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setWidth(target));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [target]);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 sm:w-32 shrink-0 truncate text-sm text-white/80">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-type-secondary">
        {Math.round(value)}%
      </span>
    </div>
  );
}
export function TasteChart() {
  const profile = useTasteProfile();
  const { shares, avoided } = useMemo(() => {
    const movie = buildTasteAffinities(profile, "movie").genres;
    const shows = buildTasteAffinities(profile, "tv").genres;
    // Explicit preferences apply once; combine movie and show rating signals.
    const preferences = buildTasteAffinities(
      { ...profile, ratings: {} },
      "movie",
    ).genres;
    const combined = [...new Set([...movie.keys(), ...shows.keys()])].map(
      (genre) =>
        [
          genre,
          (movie.get(genre) ?? 0) +
            (shows.get(genre) ?? 0) -
            (preferences.get(genre) ?? 0),
        ] as const,
    );
    const positive = combined
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
    const total = positive.reduce((sum, [, value]) => sum + value, 0);
    return {
      shares: positive.map(([genre, value]) => ({
        genre,
        value: (value / total) * 100,
        color: colorFor(genre),
      })),
      avoided: combined
        .filter(([, value]) => value < 0)
        .sort((a, b) => a[1] - b[1])
        .map(([genre, value]) => ({ genre, value: Math.abs(value) * 100 })),
    };
  }, [profile]);
  const seam = shares.length
    ? mixedColor(shares[shares.length - 1].color, shares[0].color)
    : "transparent";
  let position = 0;
  const stops = shares.flatMap((share) => {
    const start = position;
    position += share.value;
    const fade = Math.min(2.5, share.value / 4);
    return [
      `${share.color} ${start + fade}%`,
      `${share.color} ${position - fade}%`,
    ];
  });
  const count = Object.keys(profile.ratings).length;
  return (
    <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
      <div
        className="relative h-56 w-56 shrink-0"
        role="img"
        aria-label={`Taste profile: ${shares.map((share) => `${share.genre} ${Math.round(share.value)}%`).join(", ") || "No positive genre preferences yet"}`}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              shares.length === 1
                ? shares[0].color
                : shares.length
                  ? `conic-gradient(${seam} 0%, ${stops.join(", ")}, ${seam} 100%)`
                  : "rgb(255 255 255 / .05)",
            maskImage:
              "radial-gradient(closest-side, transparent 62%, black 63%)",
            WebkitMaskImage:
              "radial-gradient(closest-side, transparent 62%, black 63%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{count}</span>
          <span className="text-sm text-type-secondary">
            {count === 1 ? "rating" : "ratings"}
          </span>
        </div>
      </div>
      <div className="w-full flex-1 space-y-6">
        {shares.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              What you love
            </h2>
            <div className="space-y-2">
              {shares.map((share) => (
                <GenreBar
                  key={share.genre}
                  label={share.genre}
                  value={share.value}
                  max={shares[0].value}
                  color={share.color}
                />
              ))}
            </div>
          </section>
        ) : null}
        {avoided.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              What you avoid
            </h2>
            <div className="space-y-2">
              {avoided.map((share) => (
                <GenreBar
                  key={share.genre}
                  label={share.genre}
                  value={share.value}
                  max={avoided[0].value}
                  color="#6b7280"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
