import { useEffect, useRef, useState } from "react";

import { uniqueLibraryItems } from "@/backend/jellyfin/browse";
import { JellyfinItem, getImageUrl } from "@/backend/jellyfin/client";
import { getLibraryPerson, getPersonLibrary } from "@/backend/jellyfin/people";
import { seerrImage, seerrToMediaItem } from "@/backend/seerr/api";
import {
  SeerrFilmography,
  SeerrPerson,
  findSeerrPerson,
  getSeerrPerson,
  getSeerrPersonCredits,
} from "@/backend/seerr/browse";
import { SeerrMedia } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { MediaCard } from "@/components/media/MediaCard";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

import { JellyfinMediaCard } from "./JellyfinMediaCarousel";

export interface PersonSelection {
  name: string;
  jellyfinId?: string;
  tmdbId?: number;
}

function PersonContent({
  person,
  open,
  afterLeave,
  onClose,
  onSelectJellyfin,
  onSelectSeerr,
}: {
  person: PersonSelection;
  open: boolean;
  afterLeave: () => void;
  onClose: () => void;
  onSelectJellyfin: (id: string) => void;
  onSelectSeerr: (media: SeerrMedia) => void;
}) {
  const session = useJellyfinAuth((state) => state.session);
  const connection = useSeerrConnection((state) => state.connection);
  const seerrEnabled = matchesSeerrSession(connection, session);
  const [libraryPerson, setLibraryPerson] = useState<JellyfinItem>();
  const [remotePerson, setRemotePerson] = useState<SeerrPerson>();
  const [library, setLibrary] = useState<JellyfinItem[]>([]);
  const [credits, setCredits] = useState<SeerrFilmography>({
    acting: [],
    directing: [],
  });
  const [expandedBio, setExpandedBio] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [creditsLimit, setCreditsLimit] = useState(24);
  const [loading, setLoading] = useState(true);
  const [loadingSeerr, setLoadingSeerr] = useState(seerrEnabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [seerrError, setSeerrError] = useState("");
  const [retry, setRetry] = useState(0);
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setLoadingSeerr(seerrEnabled);
    setLibraryError("");
    setSeerrError("");
    const libraryPromise = getLibraryPerson(
      person.name,
      person.jellyfinId,
      person.tmdbId,
      controller.signal,
    )
      .then(async (data) => {
        if (controller.signal.aborted) return undefined;
        setLibraryPerson(data);
        if (data) {
          const page = await getPersonLibrary(data.Id, 0, controller.signal);
          if (!controller.signal.aborted) {
            setLibrary(page.Items);
            setTotal(page.TotalRecordCount ?? page.Items.length);
            setOffset(page.FetchedCount);
          }
        }
        return data;
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLibraryError(
            reason instanceof Error
              ? reason.message
              : "Unable to load library titles.",
          );
        return undefined;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    if (seerrEnabled) {
      libraryPromise
        .then(async (data) => {
          const id =
            person.tmdbId ||
            Number(data?.ProviderIds?.Tmdb) ||
            (await findSeerrPerson(person.name, controller.signal));
          if (!id || controller.signal.aborted) return;
          const [details, filmography] = await Promise.all([
            getSeerrPerson(id, controller.signal),
            getSeerrPersonCredits(id, controller.signal),
          ]);
          if (!controller.signal.aborted) {
            setRemotePerson(details);
            setCredits(filmography);
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setSeerrError(
              reason instanceof Error
                ? reason.message
                : "Unable to load Seerr filmography.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingSeerr(false);
        });
    }
    return () => controller.abort();
  }, [person, seerrEnabled, retry]);

  const loadMore = async () => {
    if (!libraryPerson || loadingMore) return;
    const signal = controllerRef.current?.signal;
    setLoadingMore(true);
    try {
      const page = await getPersonLibrary(libraryPerson.Id, offset, signal);
      if (signal?.aborted) return;
      setLibrary((items) => uniqueLibraryItems([...items, ...page.Items]));
      setOffset((value) => value + page.FetchedCount);
      setTotal(page.TotalRecordCount ?? total);
    } catch (reason) {
      if (!signal?.aborted)
        setLibraryError(
          reason instanceof Error
            ? reason.message
            : "Unable to load more titles.",
        );
    } finally {
      if (!signal?.aborted) setLoadingMore(false);
    }
  };
  const image = libraryPerson
    ? getImageUrl(libraryPerson, "Primary", 400) ||
      seerrImage(remotePerson?.profilePath, "w185")
    : seerrImage(remotePerson?.profilePath, "w185");
  const biography = new DOMParser().parseFromString(
    libraryPerson?.Overview || remotePerson?.biography || "",
    "text/html",
  ).body.textContent;
  return (
    <DetailsModalFrame
      open={open}
      onClose={onClose}
      afterLeave={afterLeave}
      label={person.name}
    >
      <div className="pointer-events-auto fixed inset-x-0 bottom-0 top-16 mx-auto max-w-5xl overflow-y-auto rounded-t-xl bg-background-main p-6 md:inset-10 md:rounded-xl md:p-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 min-w-0">
            {image ? (
              <img
                src={image}
                alt={person.name}
                className="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover ring-1 ring-white/10 shadow-lg shrink-0 mx-auto md:mx-0"
              />
            ) : (
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-white/5 ring-1 ring-white/10 shrink-0 flex items-center justify-center">
                <Icon icon={Icons.USER} className="text-3xl" />
              </div>
            )}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                {person.name}
              </h2>
              {remotePerson?.knownForDepartment ? (
                <p className="mt-2 text-sm text-type-secondary uppercase tracking-wider">
                  {remotePerson.knownForDepartment}
                </p>
              ) : null}
              {remotePerson?.birthday ? (
                <p className="mt-3 text-sm">
                  Born {remotePerson.birthday}
                  {remotePerson.placeOfBirth
                    ? ` · ${remotePerson.placeOfBirth}`
                    : ""}
                </p>
              ) : null}
              {remotePerson?.deathday ? (
                <p className="mt-1 text-sm">Died {remotePerson.deathday}</p>
              ) : null}
              {biography ? (
                <div className="mt-3">
                  <p
                    className={`whitespace-pre-line text-sm text-type-text leading-relaxed ${expandedBio ? "" : "line-clamp-6"}`}
                  >
                    {biography}
                  </p>
                  {biography.length > 400 ? (
                    <button
                      type="button"
                      className="tabbable mt-2 text-sm text-type-link"
                      aria-expanded={expandedBio}
                      onClick={() => setExpandedBio((value) => !value)}
                    >
                      {expandedBio ? "Show less" : "Read more"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close person details"
            className="tabbable rounded-full bg-white/10 p-3 text-white"
            onClick={onClose}
          >
            <Icon icon={Icons.X} />
          </button>
        </div>
        <h3 className="text-xl font-bold text-white mb-6">In your library</h3>
        {loading ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {library.map((item) => (
            <JellyfinMediaCard
              key={item.Id}
              item={item}
              onSelect={(selected) => {
                onClose();
                onSelectJellyfin(selected.Id);
              }}
            />
          ))}
        </div>
        {!loading && !library.length && !libraryError ? (
          <p className="text-type-secondary">
            No movies or series featuring this person are available in your
            library.
          </p>
        ) : null}
        {libraryError ? (
          <p role="alert" className="my-4">
            {libraryError}
          </p>
        ) : null}
        {offset < total ? (
          <div className="mt-6">
            <Button theme="secondary" loading={loadingMore} onClick={loadMore}>
              More library titles
            </Button>
          </div>
        ) : null}
        {seerrEnabled ? (
          <div className="mt-10">
            <h3 className="text-xl font-bold text-white mb-6">
              Filmography on Seerr
            </h3>
            {loadingSeerr ? (
              <div className="py-8">
                <Spinner />
              </div>
            ) : null}
            {(
              [
                ["acting", "Cast"],
                ["directing", "Director"],
              ] as const
            ).map(([key, title]) =>
              credits[key].length ? (
                <section key={key} className="mb-10">
                  <h4 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                    <Icon icon={Icons.RISING_STAR} />
                    {title}
                  </h4>
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                    {credits[key].slice(0, creditsLimit).map((media) => (
                      <MediaCard
                        key={`${key}:${media.mediaType}:${media.id}`}
                        media={seerrToMediaItem(media)}
                        linkable
                        onShowDetails={() => {
                          onClose();
                          onSelectSeerr(media);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
            {seerrError ? (
              <p role="alert" className="my-4">
                {seerrError}
              </p>
            ) : null}
            {!loadingSeerr &&
            !credits.acting.length &&
            !credits.directing.length &&
            !seerrError ? (
              <p className="text-type-secondary">
                No additional filmography is available.
              </p>
            ) : null}
            {Math.max(credits.acting.length, credits.directing.length) >
            creditsLimit ? (
              <div className="mt-6">
                <Button
                  theme="secondary"
                  onClick={() => setCreditsLimit((value) => value + 24)}
                >
                  More filmography
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {libraryError || seerrError ? (
          <div className="mt-6">
            <Button
              theme="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    </DetailsModalFrame>
  );
}

export function PersonModal({
  person,
  onClose,
  onSelectJellyfin,
  onSelectSeerr,
}: {
  person?: PersonSelection | null;
  onClose: () => void;
  onSelectJellyfin: (id: string) => void;
  onSelectSeerr: (media: SeerrMedia) => void;
}) {
  const presence = useRetainedModalValue(person);
  return presence.value ? (
    <PersonContent
      key={`${presence.value.jellyfinId || presence.value.tmdbId || presence.value.name}`}
      person={presence.value}
      open={presence.open}
      afterLeave={presence.afterLeave}
      onClose={onClose}
      onSelectJellyfin={onSelectJellyfin}
      onSelectSeerr={onSelectSeerr}
    />
  ) : null;
}
