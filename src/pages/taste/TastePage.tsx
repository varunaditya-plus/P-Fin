import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  enrichTasteMedia,
  searchTasteMedia,
  seerrTasteEnabled,
  tastePoster,
} from "@/backend/personalisation/catalog";
import {
  RatedTasteMedia,
  TasteCandidate,
  TasteMedia,
  TasteType,
} from "@/backend/personalisation/types";
import { getSeerrUser } from "@/backend/seerr/api";
import { SeerrUser } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { WideContainer } from "@/components/layout/WideContainer";
import { MediaCard } from "@/components/media/MediaCard";
import { Heading1 } from "@/components/utils/Text";
import { CarouselNavButtons } from "@/pages/discover/components/CarouselNavButtons";
import { SeerrDetailsModal } from "@/pages/discover/SeerrDetailsModal";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { useSeerrConnection } from "@/stores/seerr";
import { useTasteProfile, useTasteStore } from "@/stores/taste";

import { RatingCapsule } from "./RatingCapsule";
import { TasteChart } from "./TasteChart";
import { TasteQuiz } from "./TasteQuiz";
import { usePersonalRecommendations } from "./usePersonalRecommendations";

const ratingLabels: Record<string, string> = {
  loved: "Loved it",
  liked: "Liked it",
  okay: "It was okay",
  disliked: "Didn't like it",
  hated: "Hated it",
};
function TasteRow({
  media,
  onSelect,
  remove,
}: {
  media: TasteMedia;
  onSelect: (media: TasteMedia) => void;
  remove?: () => void;
}) {
  const rating = (media as RatedTasteMedia).rating;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
      <button
        type="button"
        aria-label={`Details for ${media.title}`}
        onClick={() => onSelect(media)}
        className="tabbable shrink-0 rounded"
      >
        {tastePoster(media) ? (
          <img
            src={tastePoster(media)}
            alt=""
            className="h-16 w-11 rounded object-cover"
          />
        ) : (
          <div className="h-16 w-11 rounded bg-white/10" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onSelect(media)}
          className="tabbable block max-w-full truncate text-left text-sm font-medium text-white"
        >
          {media.title}
        </button>
        <p className="text-xs text-type-secondary">
          {media.year ?? "—"} · {media.type === "movie" ? "Movie" : "Show"}
          {rating ? ` · ${ratingLabels[rating]}` : ""}
        </p>
      </div>
      <RatingCapsule media={media} />
      {remove ? (
        <button
          type="button"
          aria-label={`Remove rating for ${media.title}`}
          title="Remove rating"
          onClick={remove}
          className="tabbable p-2 text-type-secondary transition-colors hover:text-white"
        >
          <Icon icon={Icons.X} />
        </button>
      ) : null}
    </div>
  );
}
function TasteRecommendations({
  type,
  onSelect,
}: {
  type: TasteType;
  onSelect: (media: TasteMedia) => void;
}) {
  const recommendations = usePersonalRecommendations("library", type);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const id = `taste-${type}`;
  if (!recommendations.ranked.length)
    return recommendations.loading ? (
      <p role="status" className="text-sm text-type-secondary">
        Finding {type === "movie" ? "movies" : "shows"} in your library…
      </p>
    ) : recommendations.error ? (
      <p role="alert" className="text-sm text-type-secondary">
        {recommendations.error}
      </p>
    ) : null;
  return (
    <section
      aria-label={type === "movie" ? "Recommended movies" : "Recommended shows"}
    >
      <h3 className="mb-3 text-xl font-bold text-white">
        {type === "movie" ? "Movies" : "Shows"}
      </h3>
      <div className="relative overflow-hidden carousel-container">
        <div
          ref={(element) => {
            refs.current[id] = element;
          }}
          className="grid grid-flow-col auto-cols-max gap-4 overflow-x-auto scrollbar-none"
        >
          {recommendations.ranked.slice(0, 20).map(({ candidate }) => (
            <div
              key={candidate.media.key}
              className="w-[10rem] md:w-[11.5rem] p-2"
            >
              <MediaCard
                media={{
                  id: candidate.media.key,
                  title: candidate.media.title,
                  year: candidate.media.year,
                  poster: tastePoster(candidate.media),
                  type: type === "movie" ? "movie" : "show",
                }}
                linkable
                onShowDetails={() => onSelect(candidate.media)}
              />
            </div>
          ))}
        </div>
        <CarouselNavButtons categorySlug={id} carouselRefs={refs} />
      </div>
    </section>
  );
}
export default function TastePage() {
  const session = useJellyfinAuth((state) => state.session);
  const connection = useSeerrConnection((state) => state.connection);
  const profile = useTasteProfile();
  const store = useTasteStore();
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
  const rated = Object.values(profile.ratings).sort(
    (a, b) => b.ratedAt - a.ratedAt,
  );
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
          <div>
            <Heading1>Your taste</Heading1>
            <p className="mt-2 text-type-secondary">
              This is what your ratings have taught your recommendations so far.
              Love and hate count more than like and dislike. Ratings are
              separate from Jellyfin favourites and watched status.
            </p>
          </div>
          {quiz ? (
            <TasteQuiz key={identity} onFinish={() => setQuiz(false)} />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">
                  {profile.preferences.completedQuiz
                    ? "Tune your recommendations"
                    : "Create my taste profile"}
                </p>
                <p className="text-sm text-type-secondary">
                  {profile.preferences.completedQuiz
                    ? "Retake the quiz to update your taste profile."
                    : "Rate a few movies and shows and we'll start suggesting things you'll like."}
                </p>
              </div>
              <Button theme="purple" onClick={() => setQuiz(true)}>
                {profile.preferences.completedQuiz
                  ? "Retake quiz"
                  : "Get started"}
              </Button>
            </div>
          )}
          {rated.length ? (
            <TasteChart />
          ) : (
            <div className="rounded-xl bg-white/5 p-6 text-center text-type-secondary">
              No ratings yet. Take the quiz to get some, or search below to rate
              something you have seen already.
            </div>
          )}
          {rated.length ? (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-white">
                We think you would like…
              </h2>
              <TasteRecommendations type="movie" onSelect={select} />
              <TasteRecommendations type="tv" onSelect={select} />
            </section>
          ) : null}
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-white">
              Rate something you have watched
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                aria-label="Find watched titles"
                placeholder="Search a title you have seen…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="flex-1 min-w-0 rounded-xl bg-white/5 px-4 py-3 text-white placeholder:text-type-secondary tabbable"
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
            <div className="space-y-2">
              {results.map((item) => (
                <div
                  key={item.media.key}
                  onPointerEnter={() => enrichResult(item.media)}
                  onFocus={() => enrichResult(item.media)}
                >
                  <TasteRow media={item.media} onSelect={select} />
                </div>
              ))}
            </div>
          </section>
          {rated.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Your ratings</h2>
              <div className="space-y-2">
                {rated.map((media) => (
                  <TasteRow
                    key={media.key}
                    media={media}
                    onSelect={select}
                    remove={() => store.remove(media.key)}
                  />
                ))}
              </div>
            </section>
          ) : null}
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
