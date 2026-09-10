import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  enrichTasteMedia,
  searchTasteMedia,
  seerrTasteEnabled,
  tastePoster,
} from "@/backend/personalisation/catalog";
import { buildTasteAffinities } from "@/backend/personalisation/engine";
import {
  FRANCHISES,
  GENRES,
  MOODS,
  TasteCandidate,
  TasteMedia,
  TasteType,
} from "@/backend/personalisation/types";
import { getSeerrUser } from "@/backend/seerr/api";
import { SeerrUser } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { WideContainer } from "@/components/layout/WideContainer";
import { MediaCard } from "@/components/media/MediaCard";
import { Heading1 } from "@/components/utils/Text";
import { SeerrDetailsModal } from "@/pages/discover/SeerrDetailsModal";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { useSeerrConnection } from "@/stores/seerr";
import { useTasteProfile, useTasteStore } from "@/stores/taste";

import { RatingCapsule } from "./RatingCapsule";
import { TasteQuiz } from "./TasteQuiz";

function TasteCard({
  media,
  onSelect,
  remove,
}: {
  media: TasteMedia;
  onSelect: (media: TasteMedia) => void;
  remove?: () => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <MediaCard
        media={{
          id: media.key,
          title: media.title,
          year: media.year,
          poster: tastePoster(media),
          type: media.type === "tv" ? "show" : "movie",
          release_date: new Date(0),
        }}
        onShowDetails={() => onSelect(media)}
      />
      <div className="flex items-center justify-between gap-2">
        <RatingCapsule media={media} />
        {remove ? (
          <button
            type="button"
            className="tabbable text-xs text-type-secondary hover:text-white"
            onClick={remove}
            aria-label={`Remove rating for ${media.title}`}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
function TasteChart({ type }: { type: TasteType }) {
  const profile = useTasteProfile();
  const affinities = useMemo(
    () =>
      [...buildTasteAffinities(profile, type).genres].sort(
        (a, b) => b[1] - a[1],
      ),
    [profile, type],
  );
  const positive = affinities.filter(([, weight]) => weight > 0);
  const total = positive.reduce((sum, [, weight]) => sum + weight, 0);
  const colors = [
    "#3987e5",
    "#199e70",
    "#c98500",
    "#9085e9",
    "#e66767",
    "#d55181",
    "#d95926",
  ];
  let position = 0;
  const segments = positive.map(([, weight], index) => {
    const start = position;
    position += (weight / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  });
  return (
    <div className="flex flex-col sm:flex-row gap-6 rounded-xl bg-dropdown-background p-5">
      <div
        role="img"
        aria-label={`${type === "movie" ? "Movie" : "TV"} taste profile: ${positive.map(([genre, weight]) => `${genre} ${Math.round((weight / total) * 100)}%`).join(", ") || "No ratings yet"}`}
        className="relative h-40 w-40 rounded-full shrink-0 self-center"
        style={{
          background: segments.length
            ? `conic-gradient(${segments.join(", ")})`
            : "rgb(var(--colors-background-main))",
        }}
      >
        <div className="absolute inset-5 rounded-full bg-dropdown-background flex items-center justify-center text-center text-sm font-bold text-white px-3">
          {type === "movie" ? "Movie taste" : "TV taste"}
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {affinities.slice(0, 10).map(([genre, weight]) => (
          <div key={genre}>
            <div className="flex justify-between text-sm gap-3">
              <span>{genre}</span>
              <span className="text-type-secondary">
                {weight > 0 ? "Enjoy" : "Avoid"}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-background-main overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${weight > 0 ? "bg-buttons-purple" : "bg-red-400"}`}
                style={{
                  width: `${Math.min(100, (Math.abs(weight) / Math.max(...affinities.map(([, amount]) => Math.abs(amount)), 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
        {!affinities.length ? (
          <p className="text-sm text-type-secondary">
            Rate titles or choose a few genres to build your profile.
          </p>
        ) : null}
      </div>
    </div>
  );
}
export default function TastePage() {
  const session = useJellyfinAuth((state) => state.session);
  const connection = useSeerrConnection((state) => state.connection);
  const profile = useTasteProfile();
  const store = useTasteStore();
  const [type, setType] = useState<TasteType>("movie");
  const [source, setSource] = useState<"library" | "seerr">("library");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TasteCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState(false);
  const [selected, setSelected] = useState<TasteMedia>();
  const [seerrUser, setSeerrUser] = useState<SeerrUser>();
  const enabled = seerrTasteEnabled();
  const identity = JSON.stringify([
    session?.serverUrl,
    session?.userId,
    session?.accessToken,
    connection?.url,
    connection?.userId,
  ]);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  useEffect(() => {
    setSelected(undefined);
    setSeerrUser(undefined);
    setQuiz(false);
    if (enabled)
      getSeerrUser()
        .then((user) => {
          if (identityRef.current === identity) setSeerrUser(user);
        })
        .catch(() => {});
  }, [enabled, identity]);
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setError("");
    if (query.trim().length < 2 || (source === "seerr" && !enabled)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      searchTasteMedia(query.trim(), source, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setResults(items);
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to search titles.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, source, enabled, identity]);
  const selectedSeerr =
    selected?.tmdbId && !selected.jellyfinId
      ? {
          id: selected.tmdbId,
          mediaType: selected.type,
          title: selected.title,
          name: selected.title,
          posterPath: selected.posterPath,
        }
      : undefined;
  const rated = Object.values(profile.ratings)
    .filter((rating) => rating.type === type)
    .sort((a, b) => b.ratedAt - a.ratedAt);
  const select = async (media: TasteMedia) => {
    if (media.jellyfinId || (enabled && seerrUser)) setSelected(media);
    else setError("Connect Seerr in Discover to view this title's details.");
  };
  const enrichResult = async (media: TasteMedia) => {
    if (media.genres.length) return;
    const currentIdentity = identity;
    try {
      const enriched = await enrichTasteMedia(media);
      if (currentIdentity === identityRef.current)
        setResults((items) =>
          items.map((item) =>
            item.media.key === media.key ? { ...item, media: enriched } : item,
          ),
        );
    } catch {
      /* Ratings can still be stored when optional metadata is unavailable. */
    }
  };
  return (
    <SubPageLayout>
      <WideContainer>
        <div className="space-y-10 pb-12">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <Heading1>Your taste</Heading1>
              <p className="mt-2 text-type-secondary">
                Rate what you have seen to shape recommendations. Ratings are
                separate from Jellyfin favourites and watched status.
              </p>
            </div>
            <Button theme="purple" onClick={() => setQuiz((value) => !value)}>
              {quiz
                ? "Close setup"
                : profile.preferences.completedQuiz
                  ? "Retake taste setup"
                  : "Set up your taste"}
            </Button>
          </div>
          {quiz ? (
            <TasteQuiz key={identity} onFinish={() => setQuiz(false)} />
          ) : null}
          <section className="space-y-5">
            <Heading1 border>Find titles to rate</Heading1>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                aria-label="Find watched titles"
                placeholder="Search a title you have seen…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="flex-1 rounded-lg bg-dropdown-background px-4 py-3 text-white tabbable"
              />
              <select
                aria-label="Search source"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as "library" | "seerr")
                }
                className="rounded-lg bg-dropdown-background px-4 py-3 text-white tabbable"
              >
                <option value="library">Your Jellyfin library</option>
                <option value="seerr" disabled={!enabled}>
                  Seerr discovery
                </option>
              </select>
            </div>
            {!enabled ? (
              <p className="text-sm text-type-secondary">
                <Link className="text-type-link" to="/discover">
                  Connect Seerr
                </Link>{" "}
                to rate titles outside your library.
              </p>
            ) : null}
            {loading ? <p role="status">Searching…</p> : null}
            {error ? (
              <p role="alert" className="text-type-danger">
                {error}
              </p>
            ) : null}
            {!loading &&
            query.trim().length >= 2 &&
            !results.length &&
            !error ? (
              <p>No matching titles found.</p>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
              {results.map((item) => (
                <div
                  key={item.media.key}
                  onPointerEnter={() => enrichResult(item.media)}
                  onFocus={() => enrichResult(item.media)}
                >
                  <TasteCard media={item.media} onSelect={select} />
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-5">
            <Heading1 border>Preferences</Heading1>
            {(
              [
                {
                  key: "favoriteGenres",
                  title: "Favourite genres",
                  choices: GENRES.map((genre) => ({ id: genre, label: genre })),
                },
                { key: "moods", title: "Moods", choices: MOODS },
                {
                  key: "franchises",
                  title: "Franchises and studios",
                  choices: FRANCHISES,
                },
              ] as const
            ).map((group) => (
              <fieldset key={group.key}>
                <legend className="mb-3 font-bold text-white">
                  {group.title}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {group.choices.map((choice) => {
                    const active = profile.preferences[group.key].includes(
                      choice.id,
                    );
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        aria-pressed={active}
                        className={`tabbable rounded-full px-4 py-2 text-sm transition-colors ${active ? "bg-buttons-purple text-white" : "bg-dropdown-background text-type-secondary hover:text-white"}`}
                        onClick={() =>
                          store.setPreferences({
                            [group.key]: active
                              ? profile.preferences[group.key].filter(
                                  (id) => id !== choice.id,
                                )
                              : [...profile.preferences[group.key], choice.id],
                          })
                        }
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </section>
          <section className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <Heading1 border>Your ratings</Heading1>
              <div className="flex gap-2">
                {(["movie", "tv"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={type === value}
                    className={`tabbable rounded-full px-4 py-2 text-sm ${type === value ? "bg-buttons-purple text-white" : "bg-dropdown-background"}`}
                    onClick={() => setType(value)}
                  >
                    {value === "movie" ? "Movies" : "TV shows"}
                  </button>
                ))}
              </div>
            </div>
            <TasteChart type={type} />
            <p className="text-sm text-type-secondary">
              {rated.length} rated {type === "movie" ? "movies" : "shows"}.
              Select the active rating again to clear it.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
              {rated.map((media) => (
                <TasteCard
                  key={media.key}
                  media={media}
                  onSelect={select}
                  remove={() => store.remove(media.key)}
                />
              ))}
            </div>
          </section>
          <JellyfinDetailsModal
            itemId={selected?.jellyfinId}
            onClose={() => setSelected(undefined)}
          />
          {seerrUser ? (
            <SeerrDetailsModal
              media={selectedSeerr}
              user={seerrUser}
              onClose={() => setSelected(undefined)}
              onRequested={() => {}}
              onSelectMedia={(media) =>
                setSelected({
                  ...selected!,
                  key: `tmdb:${media.mediaType}:${media.id}`,
                  type: media.mediaType,
                  title: media.title ?? media.name ?? "Untitled",
                  tmdbId: media.id,
                  jellyfinId: undefined,
                  imageTag: undefined,
                  genres: [],
                })
              }
            />
          ) : null}
        </div>
      </WideContainer>
    </SubPageLayout>
  );
}
