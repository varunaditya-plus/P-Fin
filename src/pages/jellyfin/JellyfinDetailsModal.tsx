import classNames from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  JellyfinItem,
  getEpisodes,
  getImageUrl,
  getSeasons,
  getSimilarItems,
  setPlayed,
} from "@/backend/jellyfin/client";
import {
  ContentItem,
  ContentPolicy,
  contentDownloadUrl,
  contentPermissions,
  getContentItem,
  getContentPolicy,
} from "@/backend/jellyfin/content";
import { resolveJellyfinDetailsItem } from "@/backend/jellyfin/details";
import { episodeQueue, matchesEpisode } from "@/backend/jellyfin/episodeQueue";
import {
  getCollectionItems,
  getPlaylistItems,
} from "@/backend/jellyfin/library";
import { tasteMediaFromJellyfin } from "@/backend/personalisation/catalog";
import { Button } from "@/components/buttons/Button";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { DetailsSkeleton } from "@/components/overlays/detailsModal/components/layout/DetailsSkeleton";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { Flare } from "@/components/utils/Flare";
import { RatingCapsule } from "@/pages/taste/RatingCapsule";
import { usePreferencesStore } from "@/stores/preferences";

import { ContentContainerManagement } from "./ContentContainerManagement";
import { ContentInformation } from "./ContentInformation";
import { ContentProviderLinks } from "./ContentProviderLinks";
import { ContentSettingsModal } from "./ContentSettingsModal";
import { JellyfinMediaCarousel } from "./JellyfinMediaCarousel";
import { JellyfinTrackChoice } from "./JellyfinTrackSelection";
import { PersonModal, PersonSelection } from "./PersonModal";

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

function JellyfinDetailsContent({
  itemId,
  open,
  afterLeave,
  onClose,
  onItemChanged,
  initialAction,
}: {
  itemId: string;
  open: boolean;
  afterLeave: () => void;
  onClose: () => void;
  onItemChanged?: () => void;
  initialAction?: "collection" | "playlist";
}) {
  const navigate = useNavigate();
  const [selectedPerson, setSelectedPerson] = useState<PersonSelection>();
  const [selectedId, setSelectedId] = useState(itemId);
  const [selectedAction, setSelectedAction] = useState(initialAction);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [item, setItem] = useState<ContentItem | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [tracks, setTracks] = useState<JellyfinTrackChoice>({});
  const [contents, setContents] = useState<JellyfinItem[]>([]);
  const [contentsTotal, setContentsTotal] = useState(0);
  const [contentsOffset, setContentsOffset] = useState(0);
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentsError, setContentsError] = useState("");
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [similar, setSimilar] = useState<JellyfinItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [shuffling, setShuffling] = useState(false);
  const shuffleRequest = useRef<AbortController>();
  const [error, setError] = useState("");
  const [episodeError, setEpisodeError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForEpisode, setSettingsForEpisode] = useState(false);
  const [playbackOverrideId, setPlaybackOverrideId] = useState<string | null>(
    null,
  );
  const [playbackDetails, setPlaybackDetails] = useState<ContentItem | null>(
    null,
  );
  const [policy, setPolicy] = useState<ContentPolicy | null>(null);
  const episodeCarousel = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [logoHeight, setLogoHeight] = useState(0);
  const enableImageLogos = usePreferencesStore(
    (state) => state.enableImageLogos,
  );

  useEffect(() => {
    setSelectedId(itemId);
    setSelectedAction(initialAction);
  }, [itemId, initialAction]);
  const selectItem = (id: string, action?: "collection" | "playlist") => {
    setSelectedId(id);
    setSelectedAction(action);
  };
  useEffect(() => {
    setSettingsOpen(Boolean(selectedAction));
    setSettingsForEpisode(false);
  }, [selectedId, selectedAction]);
  useEffect(() => {
    if (!open) {
      setSettingsOpen(false);
      shuffleRequest.current?.abort();
    }
  }, [open]);
  useEffect(() => () => shuffleRequest.current?.abort(), []);
  useEffect(() => setEpisodeQuery(""), [selectedId]);
  useEffect(() => {
    const controller = new AbortController();
    getContentPolicy(controller.signal)
      .then(setPolicy)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => setPlaybackOverrideId(null), [selectedSeason, selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setActionError("");
    setItem(null);
    setSourceId("");
    setContents([]);
    setContentsTotal(0);
    setContentsOffset(0);
    setContentsError("");
    setEpisodes([]);
    setSeasons([]);
    setSimilar([]);
    setSelectedSeason("");
    contentRef.current?.parentElement?.scrollTo(0, 0);
    resolveJellyfinDetailsItem(selectedId, controller.signal)
      .then(async (details) => {
        if (controller.signal.aborted) return;
        setItem(details);
        getSimilarItems(details.Id, controller.signal)
          .then((items) => {
            if (!controller.signal.aborted) setSimilar(items);
          })
          .catch(() => undefined);
        if (["BoxSet", "Playlist"].includes(details.Type)) {
          setLoadingContents(true);
          try {
            const result =
              details.Type === "Playlist"
                ? await getPlaylistItems(details.Id, 0, controller.signal)
                : await getCollectionItems(details.Id, 0, controller.signal);
            if (!controller.signal.aborted) {
              setContents(result.Items);
              setContentsOffset(result.FetchedCount);
              setContentsTotal(result.TotalRecordCount ?? result.Items.length);
            }
          } catch (reason) {
            if (!controller.signal.aborted)
              setContentsError(
                reason instanceof Error
                  ? reason.message
                  : "Unable to load the contents.",
              );
          } finally {
            if (!controller.signal.aborted) setLoadingContents(false);
          }
        }
        if (details.Type === "Series") {
          const [availableSeasons, availableEpisodes] = await Promise.all([
            getSeasons(details.Id, controller.signal),
            getEpisodes(details.Id, undefined, controller.signal),
          ]);
          const resumeEpisode = availableEpisodes.find(
            (episode) => (episode.UserData?.PlaybackPositionTicks ?? 0) > 0,
          );
          if (controller.signal.aborted) return;
          setSeasons(availableSeasons);
          setSelectedSeason(
            resumeEpisode?.SeasonId ||
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
      ? episodes.find((episode) => episode.Id === playbackOverrideId) ||
        episodes.find(
          (episode) => (episode.UserData?.PlaybackPositionTicks ?? 0) > 0,
        ) ||
        episodes.find((episode) => !episode.UserData?.Played) ||
        episodes[0]
      : item;

  const playbackItem =
    playbackDetails?.Id === playItem?.Id ? playbackDetails : playItem;
  const playbackItemId = playItem?.Id;
  const playbackTargetRef = useRef(playbackItemId);
  playbackTargetRef.current = playbackItemId;
  const playbackSourceId = playbackItem?.MediaSources?.[0]?.Id ?? "";
  useEffect(() => {
    setPlaybackDetails(null);
    if (!playbackItemId || playbackItemId === item?.Id) return;
    const controller = new AbortController();
    getContentItem(playbackItemId, controller.signal)
      .then((details) => {
        if (!controller.signal.aborted) setPlaybackDetails(details);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [playbackItemId, item?.Id]);
  useEffect(() => {
    setSourceId(playbackSourceId);
    setTracks({});
  }, [playbackItem?.Id, playbackSourceId]);
  useEffect(() => setTracks({}), [sourceId]);
  const downloadAllowed = Boolean(
    playbackItem && policy && contentPermissions(playbackItem, policy).download,
  );

  const play = (
    playable: JellyfinItem | null | undefined,
    startTicks?: number,
  ) => {
    if (!playable) return;
    const query = new URLSearchParams();
    if (playable.Id === playbackItem?.Id && sourceId)
      query.set("mediaSourceId", sourceId);
    if (playable.Id === playbackItem?.Id) {
      if (tracks.audioIndex !== undefined)
        query.set("audioIndex", String(tracks.audioIndex));
      if (tracks.subtitleIndex !== undefined)
        query.set("subtitleIndex", String(tracks.subtitleIndex));
    }
    if (startTicks !== undefined) query.set("startTicks", String(startTicks));
    onClose();
    navigate(
      `/play/${encodeURIComponent(playable.Id)}${query.size ? `?${query}` : ""}`,
    );
  };
  const reloadItem = async () => {
    const updated = await getContentItem(item?.Id ?? selectedId);
    setItem((current) => (current?.Id === updated.Id ? updated : current));
    onItemChanged?.();
  };
  const shuffleEpisodes = async (seasonOnly: boolean) => {
    if (!item || shuffling) return;
    const controller = new AbortController();
    shuffleRequest.current?.abort();
    shuffleRequest.current = controller;
    setShuffling(true);
    setActionError("");
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
      const available = await getEpisodes(
        item.Id,
        seasonOnly ? selectedSeason : undefined,
        controller.signal,
      );
      if (controller.signal.aborted || selectedIdRef.current !== selectedId)
        return;
      const first = episodeQueue(available, seed)[0];
      if (!first) throw new Error("No playable episodes are available.");
      const query = new URLSearchParams({ restart: "true", shuffle: seed });
      if (seasonOnly) query.set("shuffleSeason", selectedSeason);
      onClose();
      navigate(`/play/${encodeURIComponent(first.Id)}?${query}`);
    } catch (cause) {
      if (!controller.signal.aborted)
        setActionError(
          cause instanceof Error
            ? cause.message
            : "Unable to shuffle this series.",
        );
    } finally {
      setShuffling(false);
    }
  };
  const reloadContainer = async () => {
    if (!item || !["BoxSet", "Playlist"].includes(item.Type)) return;
    const id = item.Id;
    const desiredCount = Math.max(contentsOffset, 60);
    const updated: JellyfinItem[] = [];
    let offset = 0;
    let total = Infinity;
    setLoadingContents(true);
    setContentsError("");
    try {
      while (offset < desiredCount && offset < total) {
        const result =
          item.Type === "Playlist"
            ? await getPlaylistItems(id, offset)
            : await getCollectionItems(id, offset);
        updated.push(...result.Items);
        offset += result.FetchedCount;
        total = result.TotalRecordCount ?? offset;
        if (!result.FetchedCount) break;
      }
      if (selectedIdRef.current === id) {
        setContents(updated);
        setContentsOffset(offset);
        setContentsTotal(total === Infinity ? offset : total);
      }
      await reloadItem();
    } catch (reason) {
      if (selectedIdRef.current === id)
        setContentsError(
          reason instanceof Error
            ? reason.message
            : "Unable to refresh these items.",
        );
      throw reason;
    } finally {
      if (selectedIdRef.current === id) setLoadingContents(false);
    }
  };
  const loadMoreContents = async () => {
    if (!item || loadingContents) return;
    const id = item.Id;
    setLoadingContents(true);
    setContentsError("");
    try {
      const result =
        item.Type === "Playlist"
          ? await getPlaylistItems(id, contentsOffset)
          : await getCollectionItems(id, contentsOffset);
      if (selectedIdRef.current === id) {
        setContents((current) => [...current, ...result.Items]);
        setContentsOffset((offset) => offset + result.FetchedCount);
        if (!result.FetchedCount) setContentsTotal(contentsOffset);
      }
    } catch (reason) {
      if (selectedIdRef.current === id)
        setContentsError(
          reason instanceof Error
            ? reason.message
            : "Unable to load more items.",
        );
    } finally {
      if (selectedIdRef.current === id) setLoadingContents(false);
    }
  };

  const updateUserData = async (target: JellyfinItem, field: "Played") => {
    if (updating) return;
    setUpdating(true);
    setActionError("");
    const value = !target.UserData?.[field];
    try {
      await setPlayed(target.Id, value);
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

  const scrollEpisodes = (direction: number) =>
    episodeCarousel.current?.scrollBy({
      left: direction * 544,
      behavior: "smooth",
    });
  useEffect(() => {
    const element = logoRef.current;
    if (!element) {
      setLogoHeight(0);
      return;
    }
    const measure = () => setLogoHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, item?.Id, enableImageLogos]);
  const title = item?.Name;
  const backdrop = item ? getImageUrl(item, "Backdrop", 1600) : undefined;
  const logo = item?.ImageTags?.Logo
    ? getImageUrl(item, "Logo", 800)
    : undefined;

  return (
    <DetailsModalFrame
      open={open}
      onClose={onClose}
      afterLeave={afterLeave}
      label={title || "Content details"}
    >
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
              <div ref={contentRef} className="select-text">
                {loading ? (
                  <DetailsSkeleton />
                ) : error ? (
                  <div className="p-12 pt-24 text-center" role="alert">
                    {error}
                  </div>
                ) : item ? (
                  <div className="relative h-full flex flex-col">
                    <div
                      className="relative -mt-12 z-20 shrink-0"
                      style={{ height: Math.max(500, logoHeight + 400) }}
                    >
                      <div
                        ref={logoRef}
                        className="absolute inset-x-0 bottom-20 z-30 px-6"
                      >
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
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-4">
                            {[
                              "Series",
                              "Movie",
                              "Episode",
                              "Video",
                              "Trailer",
                              "MusicVideo",
                            ].includes(item.Type) ? (
                              <Button
                                onClick={() => play(playItem)}
                                theme="purple"
                                disabled={!playItem || loadingEpisodes}
                                loading={loadingEpisodes}
                                className="flex-1 sm:flex-initial sm:w-auto gap-2 h-12 rounded-lg px-4 py-2 my-1 transition-transform hover:scale-105 duration-100 text-md text-white flex items-center justify-center"
                              >
                                <Icon
                                  icon={Icons.PLAY}
                                  className="text-white"
                                />
                                <span className="text-white text-sm pr-1">
                                  {playItem?.UserData?.PlaybackPositionTicks
                                    ? "Resume"
                                    : "Play"}
                                  {item.Type === "Series" && playItem
                                    ? ` S${playItem.ParentIndexNumber}:E${playItem.IndexNumber}`
                                    : ""}
                                </span>
                              </Button>
                            ) : null}
                            {["Movie", "Series"].includes(item.Type) ? (
                              <RatingCapsule
                                media={tasteMediaFromJellyfin(item)}
                              />
                            ) : null}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {playbackItem &&
                              [
                                "Movie",
                                "Episode",
                                "Video",
                                "Trailer",
                                "MusicVideo",
                              ].includes(playbackItem.Type) ? (
                                <button
                                  type="button"
                                  disabled={!downloadAllowed}
                                  onClick={() =>
                                    window.open(
                                      contentDownloadUrl(playbackItem.Id),
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                  title={
                                    downloadAllowed
                                      ? item.Type === "Series"
                                        ? `Download S${playbackItem.ParentIndexNumber}:E${playbackItem.IndexNumber}`
                                        : "Download"
                                      : "Downloads are unavailable for this account"
                                  }
                                  aria-label="Download"
                                  className="p-2 opacity-75 transition-all duration-300 hover:scale-110 hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <IconPatch icon={Icons.DOWNLOAD} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setSettingsForEpisode(false);
                                  setSettingsOpen(true);
                                }}
                                title="Content settings"
                                aria-label="Content settings"
                                className="p-2 opacity-75 transition-all duration-300 hover:scale-110 hover:opacity-95"
                              >
                                <IconPatch icon={Icons.SETTINGS} />
                              </button>
                            </div>
                          </div>
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
                                {new Date(item.PremiereDate).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )}
                              </p>
                            ) : null}
                            {item.OfficialRating ? (
                              <p>
                                <span className="font-medium">Rating: </span>
                                {item.OfficialRating}
                              </p>
                            ) : null}
                            {item.OriginalLanguage ? (
                              <p>
                                <span className="font-medium">Language: </span>
                                {item.OriginalLanguage.toUpperCase()}
                              </p>
                            ) : null}
                            <ContentProviderLinks item={item} />
                            {item.UserData?.Played ? <p>Watched</p> : null}
                          </div>
                        </div>
                      </div>
                      <ContentInformation
                        item={item}
                        playbackItem={playbackItem}
                        sourceId={sourceId}
                        onPlay={play}
                      />
                      {["BoxSet", "Playlist"].includes(item.Type) ? (
                        <section className="my-6">
                          <h4 className="text-lg font-semibold text-white mb-4">
                            {item.Type === "Playlist"
                              ? "Playlist"
                              : "Collection"}{" "}
                            · {contentsTotal} items
                          </h4>
                          {contents.length ? (
                            <div className="-mx-6">
                              <JellyfinMediaCarousel
                                id={`contents-${item.Id}`}
                                title=""
                                items={contents}
                                onSelect={(
                                  selected,
                                  action?: "collection" | "playlist",
                                ) => selectItem(selected.Id, action)}
                                onItemChanged={reloadItem}
                              />
                            </div>
                          ) : null}
                          <ContentContainerManagement
                            key={item.Id}
                            item={item}
                            entries={contents}
                            onChanged={reloadContainer}
                          />
                          {contentsError ? (
                            <p role="alert" className="text-sm text-red-400">
                              {contentsError}
                            </p>
                          ) : null}
                          {loadingContents ? (
                            <Spinner />
                          ) : contentsOffset < contentsTotal ? (
                            <Button
                              theme="secondary"
                              onClick={loadMoreContents}
                            >
                              Load more items
                            </Button>
                          ) : !contents.length ? (
                            <p className="text-sm text-type-secondary">
                              No items are available.
                            </p>
                          ) : null}
                        </section>
                      ) : null}
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
                          <div className="mb-4 flex flex-wrap items-center gap-2">
                            <input
                              aria-label="Find episode by title, number or S2E3"
                              placeholder="Find episode by title, number or S2E3"
                              className="min-w-0 flex-1 rounded-xl bg-dropdown-background px-3 py-2 text-sm text-white tabbable"
                              value={episodeQuery}
                              onChange={(event) => {
                                setEpisodeQuery(event.target.value);
                                const reference =
                                  event.target.value.match(/^s(\d+)e/i);
                                const season =
                                  reference &&
                                  seasons.find(
                                    (entry) =>
                                      entry.IndexNumber ===
                                      Number(reference[1]),
                                  );
                                if (season) setSelectedSeason(season.Id);
                              }}
                            />
                            <Button
                              theme="secondary"
                              padding="px-3 py-2"
                              disabled={
                                shuffling || loadingEpisodes || !episodes.length
                              }
                              onClick={() => shuffleEpisodes(true)}
                            >
                              Shuffle season
                            </Button>
                            <Button
                              theme="secondary"
                              padding="px-3 py-2"
                              disabled={shuffling}
                              onClick={() => shuffleEpisodes(false)}
                            >
                              Shuffle series
                            </Button>
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
                                {episodes
                                  .filter((episode) =>
                                    matchesEpisode(episode, episodeQuery),
                                  )
                                  .map((episode) => (
                                    <div
                                      key={episode.Id}
                                      className="flex-shrink-0 transition-all duration-200 relative hover:scale-95 rounded-lg overflow-hidden hover:bg-white/5 w-52 md:w-64"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => play(episode)}
                                        className="w-full text-left"
                                        aria-label={`Play episode ${episode.IndexNumber}: ${episode.Name}`}
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
                                      <div className="absolute top-2 right-2 flex gap-1">
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
                                          title={
                                            episode.UserData?.Played
                                              ? "Mark as unwatched"
                                              : "Mark as watched"
                                          }
                                          className="tabbable p-1.5 bg-black/50 rounded-full hover:bg-black/80 transition-colors disabled:opacity-50"
                                        >
                                          <Icon
                                            icon={
                                              episode.UserData?.Played
                                                ? Icons.EYE_SLASH
                                                : Icons.EYE
                                            }
                                            className="h-4 w-4 text-white/80"
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPlaybackOverrideId(episode.Id);
                                            setSettingsForEpisode(true);
                                            setSettingsOpen(true);
                                          }}
                                          aria-label={`Settings for episode ${episode.IndexNumber}: ${episode.Name}`}
                                          title="Episode settings"
                                          className="tabbable p-1.5 bg-black/50 rounded-full hover:bg-black/80 transition-colors"
                                        >
                                          <Icon
                                            icon={Icons.SETTINGS}
                                            className="h-4 w-4 text-white/80"
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
                                <button
                                  type="button"
                                  key={person.Id || person.Name}
                                  className="flex-shrink-0 w-28 text-center tabbable rounded-lg"
                                  onClick={() =>
                                    setSelectedPerson({
                                      name: person.Name,
                                      jellyfinId: person.Id,
                                    })
                                  }
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
                                </button>
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
                            onSelect={(
                              selected,
                              action?: "collection" | "playlist",
                            ) => selectItem(selected.Id, action)}
                            onItemChanged={reloadItem}
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
      <PersonModal
        person={open ? selectedPerson : undefined}
        onClose={() => setSelectedPerson(undefined)}
        onSelectJellyfin={(id) => selectItem(id)}
        onSelectSeerr={(media) => {
          onClose();
          navigate(`/discover?media=${media.id}&type=${media.mediaType}`);
        }}
      />
      {item ? (
        <ContentSettingsModal
          open={open && settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            setSelectedAction(undefined);
          }}
          item={settingsForEpisode && playbackItem ? playbackItem : item}
          playbackItem={playbackItem}
          sourceId={sourceId}
          onSourceChange={setSourceId}
          tracks={tracks}
          onTracksChange={setTracks}
          initialAction={selectedAction}
          onPlayFromBeginning={
            playItem?.UserData?.PlaybackPositionTicks
              ? () => play(playItem, 0)
              : undefined
          }
          onSaved={async () => {
            await reloadItem();
            if (playbackItem && playbackItem.Id !== item.Id) {
              const updated = await getContentItem(playbackItem.Id);
              if (playbackTargetRef.current === updated.Id)
                setPlaybackDetails(updated);
            }
          }}
          onDeleted={() => {
            onItemChanged?.();
            onClose();
          }}
        />
      ) : null}
    </DetailsModalFrame>
  );
}

export function JellyfinDetailsModal({
  itemId,
  onClose,
  onItemChanged,
  initialAction,
  onAfterClose,
}: {
  itemId?: string | null;
  onClose: () => void;
  onItemChanged?: () => void;
  initialAction?: "collection" | "playlist";
  onAfterClose?: () => void;
}) {
  const selection = useMemo(
    () => (itemId ? { itemId, initialAction } : undefined),
    [itemId, initialAction],
  );
  const presence = useRetainedModalValue(selection);
  return presence.value ? (
    <JellyfinDetailsContent
      itemId={presence.value.itemId}
      open={presence.open}
      afterLeave={() => {
        presence.afterLeave();
        if (!presence.open) onAfterClose?.();
      }}
      onClose={onClose}
      onItemChanged={onItemChanged}
      initialAction={presence.value.initialAction}
    />
  ) : null;
}
