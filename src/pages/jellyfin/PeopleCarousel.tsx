import { useRef } from "react";

import { Icon, Icons } from "@/components/Icon";
import { CarouselNavButtons } from "@/pages/discover/components/CarouselNavButtons";

export interface DetailsPerson {
  id: string;
  name: string;
  role?: string;
  image?: string;
  director?: boolean;
}
export function PeopleCarousel({
  people,
  onSelect,
}: {
  people: DetailsPerson[];
  onSelect: (person: DetailsPerson) => void;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  if (!people.length) return null;
  const unique = new Map<string, DetailsPerson>();
  for (const person of people) {
    const existing = unique.get(person.id);
    unique.set(
      person.id,
      existing
        ? {
            ...existing,
            director: existing.director || person.director,
            role: existing.role || person.role,
          }
        : person,
    );
  }
  const ordered = [...unique.values()].sort(
    (a, b) => Number(Boolean(b.director)) - Number(Boolean(a.director)),
  );
  return (
    <div className="space-y-4 pt-8">
      <h4 className="text-lg font-semibold text-white">Cast and crew</h4>
      <div className="relative carousel-container">
        <div
          ref={(element) => {
            refs.current.cast = element;
          }}
          className="flex overflow-x-auto scrollbar-none pb-4 gap-4"
        >
          {ordered.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelect(person)}
              className="tabbable flex flex-col items-center space-y-2 shrink-0 rounded-lg transition-opacity hover:opacity-80"
            >
              <div className="relative h-32 w-32 overflow-hidden rounded-full bg-white/5">
                {person.image ? (
                  <img
                    src={person.image}
                    alt={person.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Icon
                      icon={Icons.USER}
                      className="text-3xl text-white/40"
                    />
                  </div>
                )}
              </div>
              <div className="text-center w-32 flex flex-col">
                <span className="font-medium truncate text-white">
                  {person.name}
                </span>
                <span className="text-sm truncate text-type-secondary">
                  {person.director
                    ? ["Director", person.role].filter(Boolean).join(" · ")
                    : person.role}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="hidden md:block">
          <CarouselNavButtons categorySlug="cast" carouselRefs={refs} />
        </div>
      </div>
    </div>
  );
}
