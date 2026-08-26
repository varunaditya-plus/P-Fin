import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

import {
  JellyfinItem,
  getEpisodes,
  getImageUrl,
  getItem,
  getSeasons,
  getSimilarItems,
  setFavorite,
  setPlayed,
} from "@/backend/jellyfin/client";
import { Button } from "@/components/buttons/Button";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { DetailsSkeleton } from "@/components/overlays/detailsModal/components/layout/DetailsSkeleton";
import { OverlayPortal } from "@/components/overlays/OverlayDisplay";
import { Flare } from "@/components/utils/Flare";
import { usePreferencesStore } from "@/stores/preferences";

import { JellyfinMediaCarousel } from "./JellyfinMediaCarousel";

function runtime(ticks?: number) {
  if (!ticks) return undefined;
  const minutes = Math.round(ticks / 600000000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
}

function plainText(value?: string) {
  if (!value) return "";
  // Jellyfin overviews may contain HTML. Render only their text content.
  return (
    new DOMParser().parseFromString(value, "text/html").body.textContent || ""
  );
}

export function JellyfinDetailsModal({
  itemId,
  onClose,
  onItemChanged,
}: {
  itemId: string;
  onClose: () => void;
  onItemChanged?: () => void;
}) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(itemId);
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [similar, setSimilar] = useState<JellyfinItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [error, setError] = useState("");
  const [episodeError, setEpisodeError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const episodeCarousel = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const enableImageLogos = usePreferencesStore(
    (state) => state.enableImageLogos,
  );

  useEffect(() => setSelectedId(itemId), [itemId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setActionError("");
    setItem(null);
    setEpisodes([]);
    setSeasons([]);
    setSimilar([]);
    setSelectedSeason("");
    contentRef.current?.parentElement?.scrollTo(0, 0);
    getItem(selectedId, controller.signal)
      .then(async (details) => {
        if (controller.signal.aborted) return;
        setItem(details);
        if (details.Type === "Series") {
          const availableSeasons = await getSeasons(
            details.Id,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setSeasons(availableSeasons);
          setSelectedSeason(
            availableSeasons.find((season) => !season.UserData?.Played)?.Id ||
              availableSeasons[0]?.Id ||
              "",
          );
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load this item from Jellyfin.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    getSimilarItems(selectedId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setSimilar(items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (item?.Type !== "Series" || !selectedSeason) return;
    const controller = new AbortController();
    setLoadingEpisodes(true);
    setEpisodeError("");
    setEpisodes([]);
    getEpisodes(item.Id, selectedSeason, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setEpisodes(items);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setEpisodeError(
            reason instanceof Error
              ? reason.message
              : "Unable to load episodes.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEpisodes(false);
      });
    return () => controller.abort();
  }, [item?.Id, item?.Type, selectedSeason]);

  const playItem =
    item?.Type === "Series"
      ? episodes.find(
          (episode) => (episode.UserData?.PlaybackPositionTicks ?? 0) > 0,
        ) ||
        episodes.find((episode) => !episode.UserData?.Played) ||
        episodes[0]
      : item;

  const play = (playable: JellyfinItem | null | undefined) => {
    if (!playable) return;
    onClose();
    navigate(`/play/${encodeURIComponent(playable.Id)}`);
  };

  const updateUserData = async (
    target: JellyfinItem,
    field: "IsFavorite" | "Played",
  ) => {
    if (updating) return;
    setUpdating(true);
    setActionError("");
    const value = !target.UserData?.[field];
    try {
      if (field === "IsFavorite") await setFavorite(target.Id, value);
      else await setPlayed(target.Id, value);
      const update = (current: JellyfinItem): JellyfinItem =>
        current.Id === target.Id ||
        (field === "Played" &&
          target.Type === "Series" &&
          current.SeriesId === target.Id)
          ? {
              ...current,
              UserData: {
                ...current.UserData,
                [field]: value,
                ...(field === "Played" ? { PlaybackPositionTicks: 0 } : {}),
              },
            }
          : current;
      setItem((current) => (current ? update(current) : current));
      setEpisodes((current) => current.map(update));
      setSeasons((current) => current.map(update));
      onItemChanged?.();
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : "Unable to update Jellyfin.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/?item=${encodeURIComponent(selectedId)}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError(
        "Could not copy the link. Clipboard access requires a secure browser connection.",
      );
    }
  };

  const scrollEpisodes = (direction: number) =>
    episodeCarousel.current?.scrollBy({
      left: direction * 544,
      behavior: "smooth",
    });
  const title =
    item?.Type === "Episode"
      ? `${item.SeriesName || ""}: ${item.Name}`
      : item?.Name;
  const backdrop = item ? getImageUrl(item, "Backdrop", 1600) : undefined;
  const logo = item?.ImageTags?.Logo
    ? getImageUrl(item, "Logo", 800)
    : undefined;

  return (
    <OverlayPortal
      darken
      close={onClose}
      show
      durationClass="duration-500"
      zIndex={1000}
    >
      <Helmet>
        <html data-no-scroll />
      </Helmet>
      <div className="flex absolute inset-0 items-center justify-center pt-safe">
        <Flare.Base
          className={classNames(
            "group -m-[0.705em] rounded-3xl bg-background-main",
            "max-h-[900px] max-w-[1200px]",
            "bg-mediaCard-hoverBackground/60 backdrop-filter backdrop-blur-lg shadow-lg overflow-hidden",
            "h-[97%] w-[95%]",
            "relative",
          )}
        >
          <div
            className="transition-transform duration-300 h-full relative"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Content details"}
          >
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
              <div ref={contentRef} className="select-text">
                {loading ? (
                  <DetailsSkeleton />
                ) : error ? (
                  <div className="p-12 pt-24 text-center" role="alert">
                    {error}
                  </div>
                ) : item ? (
                  <div className="relative h-full flex flex-col">
                    <div className="relative -mt-12 z-20 h-[500px]">
                      <div className="absolute inset-x-0 bottom-20 z-30 px-6">
                        {logo && enableImageLogos ? (
                          <img
                            src={logo}
                            alt={title}
                            className="max-w-[16rem] md:max-w-[20rem] lg:max-w-[30rem] max-h-[12rem] object-contain drop-shadow-lg bg-transparent"
                          />
                        ) : (
                          <h3 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                            {title}
                          </h3>
                        )}
                      </div>
                      <div
                        className="absolute inset-0 bg-cover bg-top before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]"
                        style={{
                          backgroundImage: backdrop
                            ? `url(${backdrop})`
                            : undefined,
                          backgroundPosition: "center top",
                          maskImage:
                            "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                          WebkitMaskImage:
                            "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                          zIndex: -1,
                        }}
                      />
                    </div>
                    <div className="px-6 pb-6 mt-[-70px] flex-grow relative z-30">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                          {item.CommunityRating ? (
                            <span>{item.CommunityRating.toFixed(1)} / 10</span>
                          ) : null}
                          {item.ProductionYear ? (
                            <span>• {item.ProductionYear}</span>
                          ) : null}
                          {seasons.length ? (
                            <span>• {seasons.length} seasons</span>
                          ) : null}
                          {item.Type === "Episode" ? (
                            <span>
                              • S{item.ParentIndexNumber}:E{item.IndexNumber}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Button
                              onClick={() => play(playItem)}
                              theme="purple"
                              disabled={!playItem || loadingEpisodes}
                              loading={loadingEpisodes}
                              className="flex-1 sm:flex-initial sm:w-auto gap-2 h-12 rounded-lg px-4 py-2 my-1 transition-transform hover:scale-105 duration-100 text-md text-white flex items-center justify-center"
                            >
                              <Icon icon={Icons.PLAY} className="text-white" />
                              <span className="text-white text-sm pr-1">
                                {playItem?.UserData?.PlaybackPositionTicks
                                  ? "Resume"
                                  : "Play"}
                                {item.Type === "Series" && playItem
                                  ? ` S${playItem.ParentIndexNumber}:E${playItem.IndexNumber}`
                                  : ""}
                              </span>
                            </Button>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                disabled={updating}
                                onClick={() =>
                                  updateUserData(item, "IsFavorite")
                                }
                                title={
                                  item.UserData?.IsFavorite
                                    ? "Remove from favourites"
                                    : "Add to favourites"
                                }
                                aria-label={
                                  item.UserData?.IsFavorite
                                    ? "Remove from favourites"
                                    : "Add to favourites"
                                }
                                className="p-2 opacity-75 transition-opacity duration-300 hover:scale-110 hover:cursor-pointer hover:opacity-95"
                              >
                                <IconPatch
                                  icon={
                                    item.UserData?.IsFavorite
                                      ? Icons.BOOKMARK
                                      : Icons.BOOKMARK_OUTLINE
                                  }
                                />
                              </button>
                              <button
                                type="button"
                                onClick={share}
                                title="Share"
                                aria-label="Share"
                                className="p-2 opacity-75 transition-opacity duration-300 hover:scale-110 hover:cursor-pointer hover:opacity-95"
                              >
                                <IconPatch
                                  icon={
                                    copied ? Icons.CHECKMARK : Icons.IOS_SHARE
                                  }
                                />
                              </button>
                            </div>
                          </div>
                          {item.Type === "Episode" && item.SeriesId ? (
                            <Button
                              theme="secondary"
                              onClick={() => setSelectedId(item.SeriesId!)}
                            >
                              View series
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {actionError ? (
                        <p role="alert" className="text-sm text-red-400 my-3">
                          {actionError}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-6 pt-4">
                        <div className="md:col-span-2">
                          {item.Overview ? (
                            <p className="text-sm text-white/90 mb-6">
                              {plainText(item.Overview)}
                            </p>
                          ) : null}
                          <div className="flex justify-between items-center mb-6">
                            <div className="flex flex-wrap gap-2 items-center">
                              {item.Genres?.map((genre) => (
                                <span
                                  key={genre}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white/80 transition-all duration-300 hover:scale-110"
                                >
                                  {genre}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() => updateUserData(item, "Played")}
                              className="p-1.5 bg-dropdown-background hover:bg-dropdown-hoverBackground transition-colors rounded-full ml-2"
                              title={
                                item.UserData?.Played
                                  ? "Mark as unwatched"
                                  : "Mark as watched"
                              }
                              aria-label={
                                item.UserData?.Played
                                  ? "Mark as unwatched"
                                  : "Mark as watched"
                              }
                            >
                              <Icon
                                icon={
                                  item.UserData?.Played
                                    ? Icons.EYE_SLASH
                                    : Icons.EYE
                                }
                                className="h-5 w-5 text-white"
                              />
                            </button>
                          </div>
                          {item.People?.some(
                            (person) => person.Type === "Director",
                          ) ? (
                            <p className="text-xs text-white/70 mb-6">
                              <span className="font-medium text-white/80">
                                Director:{" "}
                              </span>
                              {item.People.filter(
                                (person) => person.Type === "Director",
                              )
                                .map((person) => person.Name)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="md:col-span-1 bg-background-secondary/50 group-hover:bg-background-secondary/80 p-4 rounded-lg border-buttons-primary transition-colors duration-300 mb-6">
                          <div className="space-y-3 text-xs text-white/80">
                            {item.RunTimeTicks ? (
                              <p>
                                <span className="font-medium">Runtime: </span>
                                {runtime(item.RunTimeTicks)}
                              </p>
                            ) : null}
                            {item.PremiereDate ? (
                              <p>
                                <span className="font-medium">
                                  Release date:{" "}
                                </span>
                                {new Date(
                                  item.PremiereDate,
                                ).toLocaleDateString()}
                              </p>
                            ) : null}
                            {item.OfficialRating ? (
                              <p>
                                <span className="font-medium">Rating: </span>
                                {item.OfficialRating}
                              </p>
                            ) : null}
                            <p>
                              <span className="font-medium">Source: </span>
                              Jellyfin
                            </p>
                            {item.UserData?.Played ? <p>Watched</p> : null}
                          </div>
                        </div>
                      </div>
                      {item.Type === "Series" && (
                        <div className="mt-6 md:mt-0">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-lg font-semibold text-white">
                              Episodes
                            </h4>
                            {seasons.length > 0 ? (
                              <Dropdown
                                options={seasons.map((season) => ({
                                  id: season.Id,
                                  name: season.Name,
                                }))}
                                selectedItem={{
                                  id: selectedSeason,
                                  name:
                                    seasons.find(
                                      (season) => season.Id === selectedSeason,
                                    )?.Name || "Season",
                                }}
                                setSelectedItem={(season) =>
                                  setSelectedSeason(season.id)
                                }
                              />
                            ) : null}
                          </div>
                          {loadingEpisodes ? (
                            <div className="py-12 flex justify-center">
                              <Spinner />
                            </div>
                          ) : episodeError ? (
                            <p
                              role="alert"
                              className="text-sm text-red-400 py-6"
                            >
                              {episodeError}
                            </p>
                          ) : !episodes.length ? (
                            <p className="text-sm text-white/70 py-6">
                              No episodes are available in this library.
                            </p>
                          ) : (
                            <div className="relative">
                              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 px-4 hidden lg:block">
                                <button
                                  type="button"
                                  aria-label="Previous episodes"
                                  className="p-2 bg-black/80 hover:bg-video-context-hoverColor transition-colors rounded-full border border-video-context-border backdrop-blur-sm"
                                  onClick={() => scrollEpisodes(-1)}
                                >
                                  <Icon
                                    icon={Icons.CHEVRON_LEFT}
                                    className="text-white/80"
                                  />
                                </button>
                              </div>
                              <div
                                ref={episodeCarousel}
                                className="flex overflow-x-auto space-x-4 pb-4 pt-2 lg:px-12 scrollbar-none carousel-container"
                              >
                                {episodes.map((episode) => (
                                  <div
                                    key={episode.Id}
                                    className="flex-shrink-0 transition-all duration-200 relative hover:scale-95 rounded-lg overflow-hidden hover:bg-white/5 w-52 md:w-64"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedId(episode.Id)}
                                      className="w-full text-left"
                                      aria-label={`Details for episode ${episode.IndexNumber}: ${episode.Name}`}
                                    >
                                      <div className="relative h-[158px] w-full bg-video-context-hoverColor">
                                        <img
                                          loading="lazy"
                                          src={
                                            getImageUrl(
                                              episode,
                                              "Primary",
                                              400,
                                            ) || "/placeholder.png"
                                          }
                                          alt={episode.Name}
                                          className="w-full h-full object-cover"
                                        />
                                        <span className="absolute top-2 left-2 p-0.5 px-2 rounded inline bg-video-context-hoverColor bg-opacity-80 text-video-context-type-main text-sm">
                                          E{episode.IndexNumber}
                                        </span>
                                        {episode.UserData?.Played ? (
                                          <span className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full">
                                            <Icon icon={Icons.CHECKMARK} />
                                          </span>
                                        ) : null}
                                        {episode.UserData
                                          ?.PlaybackPositionTicks &&
                                        episode.RunTimeTicks ? (
                                          <div
                                            className="absolute bottom-0 h-1 bg-mediaCard-barFillColor"
                                            style={{
                                              width: `${Math.min(100, (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100)}%`,
                                            }}
                                          />
                                        ) : null}
                                      </div>
                                      <div className="p-3">
                                        <h3 className="font-bold text-white line-clamp-1">
                                          {episode.Name}
                                        </h3>
                                        <p className="text-xs text-white/60 mt-1">
                                          {runtime(episode.RunTimeTicks)}
                                        </p>
                                        <p className="text-xs text-white/70 line-clamp-3 mt-2">
                                          {plainText(episode.Overview)}
                                        </p>
                                      </div>
                                    </button>
                                    <div className="flex justify-between items-center px-3 pb-3">
                                      <button
                                        type="button"
                                        onClick={() => play(episode)}
                                        className="flex gap-2 items-center text-sm text-white hover:text-type-link"
                                      >
                                        <Icon icon={Icons.PLAY} />
                                        {episode.UserData?.PlaybackPositionTicks
                                          ? "Resume"
                                          : "Play"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={updating}
                                        onClick={() =>
                                          updateUserData(episode, "Played")
                                        }
                                        aria-label={
                                          episode.UserData?.Played
                                            ? `Mark ${episode.Name} as unwatched`
                                            : `Mark ${episode.Name} as watched`
                                        }
                                        className="p-1.5 bg-dropdown-background hover:bg-dropdown-hoverBackground transition-colors rounded-full"
                                      >
                                        <Icon
                                          icon={
                                            episode.UserData?.Played
                                              ? Icons.EYE_SLASH
                                              : Icons.EYE
                                          }
                                        />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 px-4 hidden lg:block">
                                <button
                                  type="button"
                                  aria-label="Next episodes"
                                  className="p-2 bg-black/80 hover:bg-video-context-hoverColor transition-colors rounded-full border border-video-context-border backdrop-blur-sm"
                                  onClick={() => scrollEpisodes(1)}
                                >
                                  <Icon
                                    icon={Icons.CHEVRON_RIGHT}
                                    className="text-white/80"
                                  />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {item.People?.some(
                        (person) => person.Type === "Actor",
                      ) ? (
                        <div className="mt-6">
                          <h4 className="text-lg font-semibold text-white mb-4">
                            Cast
                          </h4>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
                            {item.People.filter(
                              (person) => person.Type === "Actor",
                            )
                              .slice(0, 30)
                              .map((person) => (
                                <div
                                  key={person.Id || person.Name}
                                  className="flex-shrink-0 w-28 text-center"
                                >
                                  <div className="w-24 h-24 mx-auto rounded-full bg-white/5 overflow-hidden">
                                    {person.PrimaryImageTag && person.Id ? (
                                      <img
                                        loading="lazy"
                                        src={getImageUrl(
                                          {
                                            Id: person.Id,
                                            Name: person.Name,
                                            Type: "Person",
                                            ImageTags: {
                                              Primary: person.PrimaryImageTag,
                                            },
                                          },
                                          "Primary",
                                          200,
                                        )}
                                        alt={person.Name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full flex items-center justify-center">
                                        <Icon
                                          icon={Icons.USER}
                                          className="text-3xl text-white/40"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm text-white line-clamp-2">
                                    {person.Name}
                                  </p>
                                  <p className="text-xs text-white/60 line-clamp-2">
                                    {person.Role}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : null}
                      {similar.length ? (
                        <div className="mt-6 -mx-6">
                          <JellyfinMediaCarousel
                            id="similar-jellyfin"
                            title="More like this"
                            items={similar}
                            onSelect={(selected) => setSelectedId(selected.Id)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Flare.Child>
          </div>
        </Flare.Base>
      </div>
    </OverlayPortal>
  );
}
