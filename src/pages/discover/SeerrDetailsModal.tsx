import { useEffect, useRef, useState } from "react";

import { findItemByProviderId } from "@/backend/jellyfin/client";
import { tasteMediaFromSeerr } from "@/backend/personalisation/catalog";
import {
  canRequestMedia,
  getSeerrDetails,
  getSeerrQuota,
  getSeerrSettings,
  requestSeerrMedia,
  seasonRequestStatus,
  seerrImage,
  seerrStatusLabel,
} from "@/backend/seerr/api";
import {
  SeerrDetails,
  SeerrMedia,
  SeerrQuota,
  SeerrSettings,
  SeerrUser,
} from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Icon, Icons } from "@/components/Icon";
import { DetailsSkeleton } from "@/components/overlays/detailsModal/components/layout/DetailsSkeleton";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { Flare } from "@/components/utils/Flare";
import { ContentProviderLinks } from "@/pages/jellyfin/ContentProviderLinks";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { PeopleCarousel } from "@/pages/jellyfin/PeopleCarousel";
import { PersonModal, PersonSelection } from "@/pages/jellyfin/PersonModal";
import { RatingCapsule } from "@/pages/taste/RatingCapsule";

import {
  SeerrCollectionButton,
  SeerrRelatedContent,
} from "./SeerrRelatedContent";

function SeerrDetailsContent({
  media,
  user,
  open,
  afterLeave,
  onClose,
  onRequested,
  onSelectMedia,
}: {
  media: SeerrMedia;
  user: SeerrUser;
  open: boolean;
  afterLeave: () => void;
  onClose: () => void;
  onRequested: (details: SeerrDetails) => void;
  onSelectMedia?: (media: SeerrMedia) => void;
}) {
  const [selectedPerson, setPerson] = useState<PersonSelection>();
  const [details, setDetails] = useState<SeerrDetails>();
  const [settings, setSettings] = useState<SeerrSettings>();
  const [quota, setQuota] = useState<SeerrQuota>();
  const [seasons, setSeasons] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [libraryId, setLibraryId] = useState<string>();
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [showLibrary, setShowLibrary] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      getSeerrDetails(media.id, media.mediaType, controller.signal),
      getSeerrSettings(),
      getSeerrQuota(user.id),
    ])
      .then(([data, publicSettings, userQuota]) => {
        if (controller.signal.aborted) return;
        setDetails(data);
        setSettings(publicSettings);
        setQuota(userQuota);
        setSeasons(
          (data.seasons || [])
            .filter(
              (season) =>
                (season.seasonNumber > 0 ||
                  publicSettings.enableSpecialEpisodes) &&
                season.episodeCount > 0 &&
                seasonRequestStatus(data, season.seasonNumber) === 1,
            )
            .map((season) => season.seasonNumber),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this title.",
          );
      });
    return () => controller.abort();
  }, [media.id, media.mediaType, retry, user.id]);

  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    findItemByProviderId(String(media.id), media.mediaType)
      .then((item) => {
        if (!cancelled) setLibraryId(item?.Id);
      })
      .catch(() => {
        // Availability comes from the signed-in Jellyfin user's library.
        if (!cancelled) setLibraryId(undefined);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [media.id, media.mediaType]);

  const availableSeasons = (details?.seasons || []).filter(
    (season) =>
      (season.seasonNumber > 0 || settings?.enableSpecialEpisodes) &&
      season.episodeCount > 0,
  );
  const requestableSeasons = availableSeasons.filter(
    (season) =>
      details && seasonRequestStatus(details, season.seasonNumber) === 1,
  );
  const permission = canRequestMedia(user, media.mediaType);
  const requestQuota = quota?.[media.mediaType];
  const activeMovieRequest = details?.mediaInfo?.requests?.some(
    (request) => !request.is4k && [1, 2, 5].includes(request.status),
  );
  const movieUnavailable =
    !libraryId &&
    ![2, 3, 5, 6].includes(details?.mediaInfo?.status || 1) &&
    !activeMovieRequest;
  const canRequest =
    Boolean(details && settings && quota) &&
    permission &&
    details?.mediaInfo?.status !== 6 &&
    !requestQuota?.restricted &&
    !libraryLoading &&
    (media.mediaType === "movie" ? movieUnavailable : seasons.length > 0);

  const sendRequest = async () => {
    if (!canRequest || !details || submitting.current) return;
    submitting.current = true;
    setRequesting(true);
    setError("");
    setSuccess("");
    try {
      const result = await requestSeerrMedia(details, seasons, user.id);
      if (!mounted.current) return;
      const requestedDetails: SeerrDetails = {
        ...details,
        mediaInfo: {
          ...details.mediaInfo,
          status:
            details.mediaInfo?.status === 4 ? 4 : result.status === 1 ? 2 : 3,
          requests: [
            ...(details.mediaInfo?.requests || []),
            {
              ...result,
              seasons:
                result.seasons ||
                seasons.map((seasonNumber) => ({
                  seasonNumber,
                  status: result.status,
                })),
            },
          ],
        },
      };
      setDetails(requestedDetails);
      setSeasons([]);
      setSuccess(
        result.status === 1
          ? "Request sent for approval."
          : "Request sent to Seerr.",
      );
      onRequested(requestedDetails);
      // A refresh failure must not suggest that a successful POST should be retried.
      getSeerrDetails(media.id, media.mediaType)
        .then((updated) => {
          if (mounted.current) {
            setDetails(updated);
            onRequested(updated);
          }
        })
        .catch(() => undefined);
      getSeerrQuota(user.id)
        .then((value) => {
          if (mounted.current) setQuota(value);
        })
        .catch(() => undefined);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "The request could not be sent.",
        );
    } finally {
      submitting.current = false;
      if (mounted.current) setRequesting(false);
    }
  };

  const title = details?.title || details?.name || media.title || media.name;
  const release = details?.releaseDate || details?.firstAirDate;
  const runtime = details?.runtime || details?.episodeRunTime?.[0];

  return (
    <>
      <DetailsModalFrame
        open={open && !showLibrary}
        onClose={onClose}
        afterLeave={() => {
          if (!open) afterLeave();
        }}
        label={title || "Content details"}
      >
        <div className="flex absolute inset-0 items-center justify-center pt-safe">
          <Flare.Base className="group -m-[0.705em] rounded-3xl bg-background-main max-h-[900px] max-w-[1200px] bg-mediaCard-hoverBackground/60 backdrop-filter backdrop-blur-lg shadow-lg overflow-hidden h-[97%] w-[95%] relative">
            <div className="transition-transform duration-300 h-full relative">
              <Flare.Light
                flareSize={300}
                cssColorVar="--colors-mediaCard-hoverAccent"
                backgroundClass="bg-modal-background duration-100"
                className="rounded-3xl bg-background-main group-hover:opacity-100 transition-opacity duration-300"
              />
              <div className="absolute right-4 top-4 z-50 pointer-events-auto">
                <button
                  type="button"
                  aria-label="Close details"
                  className="text-s font-semibold text-type-secondary hover:text-white transition-transform hover:scale-95 select-none"
                  onClick={onClose}
                >
                  <IconPatch icon={Icons.X} />
                </button>
              </div>
              <Flare.Child className="pointer-events-auto relative h-full overflow-y-auto scrollbar-none select-text">
                {!details && !error ? (
                  <DetailsSkeleton />
                ) : !details ? (
                  <div className="p-12">
                    <p role="alert" className="mb-6">
                      {error}
                    </p>
                    <Button
                      theme="purple"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <div className="relative h-full flex flex-col">
                    <div className="relative -mt-12 z-20 h-[500px] shrink-0">
                      <div className="absolute inset-x-0 bottom-20 z-30 px-6">
                        <h3 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                          {title}
                        </h3>
                      </div>
                      <div
                        className="absolute inset-0 bg-cover bg-top before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]"
                        style={{
                          backgroundImage: `url(${seerrImage(details.backdropPath, "original") || seerrImage(details.posterPath) || "/placeholder.png"})`,
                          maskImage:
                            "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                          WebkitMaskImage:
                            "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                          zIndex: -1,
                        }}
                      />
                    </div>
                    <div className="px-6 pb-6 mt-[-70px] flex-grow relative z-30">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/80 mb-4">
                        {!!details.voteAverage && (
                          <span className="flex items-center gap-1 text-white/80">
                            <Icon icon={Icons.TMDB} />
                            {details.voteAverage.toFixed(1)}
                          </span>
                        )}
                        {release && (
                          <span className="text-white/80">
                            {new Date(release).getFullYear()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <RatingCapsule
                          media={tasteMediaFromSeerr(details ?? media)}
                        />
                        {libraryId ? (
                          <Button
                            theme="purple"
                            onClick={() => setShowLibrary(true)}
                          >
                            <Icon icon={Icons.PLAY} /> Open in library
                          </Button>
                        ) : null}
                        {(
                          media.mediaType === "movie"
                            ? movieUnavailable
                            : requestableSeasons.length > 0
                        ) ? (
                          <Button
                            theme="purple"
                            disabled={!canRequest || requesting}
                            loading={requesting}
                            onClick={sendRequest}
                          >
                            {media.mediaType === "tv"
                              ? `Request ${seasons.length || ""} season${seasons.length === 1 ? "" : "s"}`
                              : "Request movie"}
                          </Button>
                        ) : null}
                        <span className="text-sm text-white/80">
                          {libraryId
                            ? "Available in your library"
                            : seerrStatusLabel(details.mediaInfo?.status)}
                        </span>
                      </div>
                      {error && (
                        <p role="alert" className="mb-4 text-red-400">
                          {error}
                        </p>
                      )}
                      {success && (
                        <p role="status" className="mb-4 text-green-400">
                          {success}
                        </p>
                      )}
                      {!permission && (
                        <p className="mb-4 text-type-secondary">
                          Your Seerr account does not have permission to request
                          this content.
                        </p>
                      )}
                      {requestQuota?.restricted && (
                        <p className="mb-4 text-type-secondary">
                          Your Seerr request limit has been reached.
                        </p>
                      )}
                      {!libraryLoading &&
                        !libraryId &&
                        details.mediaInfo?.status === 5 && (
                          <p className="mb-4 text-type-secondary">
                            Seerr marks this title as available, but it is not
                            accessible in your Jellyfin library.
                          </p>
                        )}
                      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-6 pt-4">
                        <div className="md:col-span-2">
                          <p className="text-sm text-white/90 mb-6">
                            {details.overview}
                          </p>
                          <div className="flex flex-wrap gap-2 items-center mb-6">
                            {details.genres?.map((genre) => (
                              <span
                                key={genre.id}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white/80"
                              >
                                {genre.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="md:col-span-1">
                          <div className="bg-background-secondary/50 group-hover:bg-background-secondary/80 p-4 rounded-lg border-buttons-primary transition-colors duration-300 space-y-3 text-xs text-white/80">
                            {runtime ? (
                              <p>
                                Runtime:{" "}
                                <span className="text-white/80">
                                  {Math.floor(runtime / 60)
                                    ? `${Math.floor(runtime / 60)}h `
                                    : ""}
                                  {runtime % 60}m
                                </span>
                              </p>
                            ) : null}
                            {release ? (
                              <p>
                                Release date:{" "}
                                <span className="text-white/80">
                                  {new Date(release).toLocaleDateString(
                                    undefined,
                                    {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    },
                                  )}
                                </span>
                              </p>
                            ) : null}
                            {details.originalLanguage ? (
                              <p>
                                Language:{" "}
                                <span className="text-white/80">
                                  {details.originalLanguage.toUpperCase()}
                                </span>
                              </p>
                            ) : null}
                            <p>
                              Status:{" "}
                              <span className="text-white/80">
                                {seerrStatusLabel(details.mediaInfo?.status)}
                              </span>
                            </p>
                            {details.collection && onSelectMedia ? (
                              <SeerrCollectionButton
                                collection={details.collection}
                                onSelect={onSelectMedia}
                              />
                            ) : null}
                            <ContentProviderLinks
                              item={{
                                Id: String(media.id),
                                Name: title || "",
                                Type:
                                  media.mediaType === "movie"
                                    ? "Movie"
                                    : "Series",
                                ProviderIds: {
                                  Tmdb: String(media.id),
                                  ...(details.externalIds?.imdbId ||
                                  details.imdbId
                                    ? {
                                        Imdb:
                                          details.externalIds?.imdbId ||
                                          details.imdbId!,
                                      }
                                    : {}),
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      {media.mediaType === "tv" &&
                        availableSeasons.length > 0 && (
                          <div className="mt-8">
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <h4 className="text-xl font-bold text-white">
                                Seasons
                              </h4>
                              {settings?.partialRequestsEnabled &&
                              requestableSeasons.length > 0 ? (
                                <button
                                  type="button"
                                  className="text-sm text-type-link"
                                  onClick={() =>
                                    setSeasons(
                                      seasons.length ===
                                        requestableSeasons.length
                                        ? []
                                        : requestableSeasons.map(
                                            (season) => season.seasonNumber,
                                          ),
                                    )
                                  }
                                >
                                  {seasons.length === requestableSeasons.length
                                    ? "Clear selection"
                                    : "Select all"}
                                </button>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {availableSeasons.map((season) => {
                                const status = seasonRequestStatus(
                                  details,
                                  season.seasonNumber,
                                );
                                return (
                                  <label
                                    key={season.id}
                                    className={`flex items-center gap-3 p-4 rounded-lg bg-dropdown-background ${status > 1 ? "opacity-60" : "cursor-pointer hover:bg-dropdown-hoverBackground"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="accent-purple-500 h-4 w-4"
                                      checked={
                                        status > 1 ||
                                        seasons.includes(season.seasonNumber)
                                      }
                                      disabled={
                                        status > 1 ||
                                        !settings?.partialRequestsEnabled ||
                                        !permission ||
                                        requesting
                                      }
                                      onChange={(event) =>
                                        setSeasons((current) =>
                                          event.target.checked
                                            ? [...current, season.seasonNumber]
                                            : current.filter(
                                                (number) =>
                                                  number !==
                                                  season.seasonNumber,
                                              ),
                                        )
                                      }
                                    />
                                    <div>
                                      <p className="text-white text-sm font-medium">
                                        {season.name}
                                      </p>
                                      <p className="text-xs text-type-secondary">
                                        {season.episodeCount} episodes
                                        {status > 1
                                          ? ` · ${seerrStatusLabel(status)}`
                                          : ""}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      <PeopleCarousel
                        people={[
                          ...(details.credits?.crew ?? [])
                            .filter((person) => person.job === "Director")
                            .slice(0, 1)
                            .map((person) => ({
                              id: String(person.id),
                              name: person.name,
                              director: true,
                              image: seerrImage(person.profilePath, "w185"),
                            })),
                          ...(details.credits?.cast ?? [])
                            .filter(
                              (person) =>
                                !details.credits?.crew?.some(
                                  (crew) =>
                                    crew.id === person.id &&
                                    crew.job === "Director",
                                ),
                            )
                            .slice(0, 20)
                            .map((person) => ({
                              id: String(person.id),
                              name: person.name,
                              role: person.character,
                              image: seerrImage(person.profilePath, "w185"),
                            })),
                        ]}
                        onSelect={(person) =>
                          setPerson({
                            name: person.name,
                            tmdbId: Number(person.id),
                          })
                        }
                      />{" "}
                      {onSelectMedia ? (
                        <SeerrRelatedContent
                          details={details}
                          onSelect={onSelectMedia}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </Flare.Child>
            </div>
          </Flare.Base>
        </div>
        <PersonModal
          person={open ? selectedPerson : undefined}
          onClose={() => setPerson(undefined)}
          onSelectJellyfin={(id) => {
            setLibraryId(id);
            setShowLibrary(true);
          }}
          onSelectSeerr={(selected) => onSelectMedia?.(selected)}
        />
      </DetailsModalFrame>
      <JellyfinDetailsModal
        itemId={open && showLibrary ? libraryId : undefined}
        onClose={() => setShowLibrary(false)}
        onAfterClose={() => {
          if (!open) afterLeave();
        }}
      />
    </>
  );
}

export function SeerrDetailsModal({
  media,
  user,
  onClose,
  onRequested,
  onSelectMedia,
}: {
  media?: SeerrMedia;
  user: SeerrUser;
  onClose: () => void;
  onRequested: (details: SeerrDetails) => void;
  onSelectMedia?: (media: SeerrMedia) => void;
}) {
  const presence = useRetainedModalValue(media);
  return presence.value ? (
    <SeerrDetailsContent
      key={`${presence.value.mediaType}-${presence.value.id}`}
      media={presence.value}
      user={user}
      open={presence.open}
      afterLeave={presence.afterLeave}
      onClose={onClose}
      onRequested={onRequested}
      onSelectMedia={onSelectMedia}
    />
  ) : null;
}
