import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getItem, jellyfinUrl, setFavorite } from "@/backend/jellyfin/client";
import { getJellyfinDetailsId } from "@/backend/jellyfin/details";
import { mediaSourceLabel } from "@/backend/jellyfin/mediaSourceLabel";
import { updateUserConfiguration } from "@/backend/jellyfin/preferences";
import { Toggle } from "@/components/buttons/Toggle";
import { Icon, Icons } from "@/components/Icon";
import { Overlay } from "@/components/overlays/OverlayDisplay";
import { OverlayPage } from "@/components/overlays/OverlayPage";
import { OverlayRouter } from "@/components/overlays/OverlayRouter";
import { CaptionSettingsView } from "@/components/player/atoms/settings/CaptionSettingsView";
import { AudioBoostSettingsView } from "@/components/player/enhancements/AudioBoostSettingsView";
import { PictureSettingsView } from "@/components/player/enhancements/PictureSettingsView";
import { VideoPlayerButton } from "@/components/player/internals/Button";
import { Menu } from "@/components/player/internals/ContextMenu";
import { SelectableLink } from "@/components/player/internals/ContextMenu/Links";
import { Transition } from "@/components/utils/Transition";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { GamepadSettings } from "./GamepadSettings";
import { useJellyfinPlayback } from "./JellyfinPlaybackContext";

function JellyfinSettingsMenu() {
  const router = useOverlayRouter("settings");
  const { t } = useTranslation();
  const { playback, subtitleIndex, maxBitrate } = useJellyfinPlayback();
  const streams = playback?.mediaSource.MediaStreams ?? [];
  const audio = streams.find(
    (track) => track.Type === "Audio" && track.Index === playback?.audioIndex,
  );
  const subtitle = streams.find(
    (track) => track.Type === "Subtitle" && track.Index === subtitleIndex,
  );
  return (
    <Menu.Card>
      <Menu.Section grid>
        <Menu.ChevronLink box onClick={() => router.navigate("/quality")}>
          {t("player.menus.settings.qualityItem")}
          <span className="text-type-secondary text-sm">
            {maxBitrate === 120_000_000
              ? "Auto"
              : `${maxBitrate / 1_000_000} Mbps`}
          </span>
        </Menu.ChevronLink>
        <Menu.ChevronLink box onClick={() => router.navigate("/source")}>
          {t("player.menus.settings.sourceItem")}
          <span className="text-type-secondary text-sm">Jellyfin</span>
        </Menu.ChevronLink>
        <Menu.ChevronLink box onClick={() => router.navigate("/captions")}>
          {t("player.menus.settings.subtitleItem")}
          <span className="text-type-secondary text-sm line-clamp-1">
            {subtitle?.DisplayTitle ?? t("player.menus.subtitles.offChoice")}
          </span>
        </Menu.ChevronLink>
        <Menu.ChevronLink box onClick={() => router.navigate("/audio")}>
          {t("player.menus.settings.audioItem")}
          <span className="text-type-secondary text-sm line-clamp-1">
            {audio?.DisplayTitle ?? "Default"}
          </span>
        </Menu.ChevronLink>
      </Menu.Section>
      <Menu.Section>
        <Menu.ChevronLink onClick={() => router.navigate("/playback")}>
          {t("player.menus.settings.playbackItem")}
        </Menu.ChevronLink>
        <Menu.ChevronLink onClick={() => router.navigate("/captions/settings")}>
          Subtitle appearance
        </Menu.ChevronLink>
        <Menu.ChevronLink onClick={() => router.navigate("/controller")}>
          Controller
        </Menu.ChevronLink>
      </Menu.Section>
    </Menu.Card>
  );
}

function JellyfinPlaybackSettings() {
  const router = useOverlayRouter("settings");
  const display = usePlayerStore((state) => state.display);
  const rate = usePlayerStore((state) => state.mediaPlaying.playbackRate);
  const autoplay = usePreferencesStore((state) => state.enableAutoplay);
  const setAutoplay = usePreferencesStore((state) => state.setEnableAutoplay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toggleAutoplay = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updateUserConfiguration({ EnableNextEpisodeAutoPlay: !autoplay });
      setAutoplay(!autoplay);
    } catch {
      setError("Could not save your autoplay preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Menu.Card>
      <Menu.BackLink onClick={() => router.navigate("/")}>
        Playback
      </Menu.BackLink>
      <Menu.Section>
        <Menu.FieldTitle>Playback speed</Menu.FieldTitle>
        <div className="flex items-center bg-video-context-light/10 p-1 rounded-lg mt-3">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`w-full px-2 py-1 rounded-md tabbable ${rate === speed ? "bg-video-context-light/20 text-white" : ""}`}
              onClick={() => display?.setPlaybackRate(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
        <Menu.Link
          rightSide={<Toggle enabled={autoplay} onClick={toggleAutoplay} />}
        >
          Autoplay next episode
        </Menu.Link>
        <Menu.ChevronLink onClick={() => router.navigate("/picture")}>
          Picture
        </Menu.ChevronLink>
        <Menu.ChevronLink onClick={() => router.navigate("/audio-boost")}>
          Volume boost
        </Menu.ChevronLink>
        {error ? (
          <p role="alert" className="py-2 text-type-danger">
            {error}
          </p>
        ) : null}
      </Menu.Section>
    </Menu.Card>
  );
}

function JellyfinTracks({ kind }: { kind: "Audio" | "Subtitle" }) {
  const router = useOverlayRouter("settings");
  const { playback, subtitleIndex, changeAudio, changeSubtitle, busy } =
    useJellyfinPlayback();
  const streams =
    playback?.mediaSource.MediaStreams?.filter(
      (stream) => stream.Type === kind,
    ) ?? [];
  const choose = (index: number) => {
    if (kind === "Audio") changeAudio(index);
    else changeSubtitle(index);
    router.close();
  };
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/")}>
        {kind === "Subtitle" ? "Subtitles" : "Audio"}
      </Menu.BackLink>
      <Menu.Section className="pb-4">
        {kind === "Subtitle" ? (
          <SelectableLink
            selected={subtitleIndex === -1}
            onClick={() => choose(-1)}
          >
            Off
          </SelectableLink>
        ) : null}
        {streams.map((stream) => (
          <SelectableLink
            key={stream.Index}
            disabled={busy}
            selected={
              stream.Index ===
              (kind === "Audio" ? playback?.audioIndex : subtitleIndex)
            }
            onClick={() => choose(stream.Index)}
          >
            {stream.DisplayTitle ??
              stream.Title ??
              stream.Language ??
              `Track ${stream.Index + 1}`}
          </SelectableLink>
        ))}
        {streams.length === 0 ? (
          <p className="py-3 text-type-secondary">
            No {kind.toLowerCase()} tracks are available.
          </p>
        ) : null}
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}

export function JellyfinSettingsRouter() {
  const router = useOverlayRouter("settings");
  const {
    playback,
    mediaSources,
    maxBitrate,
    changeQuality,
    changeSource,
    busy,
  } = useJellyfinPlayback();
  return (
    <Overlay id="settings">
      <OverlayRouter id="settings">
        <OverlayPage id="settings" path="/" width={343} height={420}>
          <JellyfinSettingsMenu />
        </OverlayPage>
        <OverlayPage id="settings" path="/quality" width={343} height={420}>
          <Menu.Card>
            <Menu.BackLink onClick={() => router.navigate("/")}>
              Quality
            </Menu.BackLink>
            <Menu.Section>
              {[120_000_000, 20_000_000, 8_000_000, 2_000_000].map(
                (bitrate) => (
                  <SelectableLink
                    key={bitrate}
                    selected={maxBitrate === bitrate}
                    onClick={() => {
                      changeQuality(bitrate);
                      router.close();
                    }}
                  >
                    {bitrate === 120_000_000
                      ? "Auto (original when compatible)"
                      : `${bitrate / 1_000_000} Mbps`}
                  </SelectableLink>
                ),
              )}
            </Menu.Section>
          </Menu.Card>
        </OverlayPage>
        <OverlayPage id="settings" path="/source" width={443} height={420}>
          <Menu.CardWithScrollable>
            <Menu.BackLink onClick={() => router.navigate("/")}>
              Version
            </Menu.BackLink>
            <Menu.Section>
              {mediaSources.map((source) => (
                <SelectableLink
                  key={source.Id}
                  selected={source.Id === playback?.mediaSource.Id}
                  disabled={busy}
                  onClick={() => {
                    changeSource(source.Id);
                    router.close();
                  }}
                >
                  {mediaSourceLabel(source)}
                </SelectableLink>
              ))}
              <p className="py-3 text-type-secondary">
                {playback?.playMethod === "DirectPlay"
                  ? "Direct playback"
                  : playback?.playMethod === "DirectStream"
                    ? "Direct stream"
                    : "Transcoding for this browser"}
              </p>
            </Menu.Section>
          </Menu.CardWithScrollable>
        </OverlayPage>
        <OverlayPage id="settings" path="/audio" width={443} height={496}>
          <JellyfinTracks kind="Audio" />
        </OverlayPage>
        <OverlayPage id="settings" path="/captions" width={443} height={496}>
          <JellyfinTracks kind="Subtitle" />
        </OverlayPage>
        <OverlayPage
          id="settings"
          path="/captionsOverlay"
          width={443}
          height={496}
        >
          <JellyfinTracks kind="Subtitle" />
        </OverlayPage>
        <OverlayPage
          id="settings"
          path="/captions/settings"
          width={343}
          height={496}
        >
          <Menu.Card>
            <CaptionSettingsView id="settings" />
          </Menu.Card>
        </OverlayPage>
        <OverlayPage id="settings" path="/playback" width={343} height={330}>
          <JellyfinPlaybackSettings />
        </OverlayPage>
        <OverlayPage id="settings" path="/picture" width={343} height={496}>
          <PictureSettingsView />
        </OverlayPage>
        <OverlayPage id="settings" path="/audio-boost" width={343} height={496}>
          <AudioBoostSettingsView />
        </OverlayPage>
        <OverlayPage id="settings" path="/controller" width={443} height={496}>
          <Menu.CardWithScrollable>
            <Menu.BackLink onClick={() => router.navigate("/")}>
              Controller
            </Menu.BackLink>
            <Menu.Section>
              <GamepadSettings />
            </Menu.Section>
          </Menu.CardWithScrollable>
        </OverlayPage>
      </OverlayRouter>
    </Overlay>
  );
}

export function JellyfinEpisodesRouter() {
  const { episodes, itemId, playItem } = useJellyfinPlayback();
  const router = useOverlayRouter("episodes");
  const current = episodes.find((episode) => episode.Id === itemId);
  const [season, setSeason] = useState(current?.ParentIndexNumber ?? 1);
  const compact = usePreferencesStore((state) => state.forceCompactEpisodeView);
  useEffect(() => {
    setSeason(current?.ParentIndexNumber ?? 1);
  }, [current?.ParentIndexNumber]);
  const seasons = [
    ...new Set(episodes.map((episode) => episode.ParentIndexNumber ?? 0)),
  ].sort((a, b) => a - b);
  return (
    <Overlay id="episodes">
      <OverlayRouter id="episodes">
        <OverlayPage id="episodes" path="/" width={343} height={431}>
          <Menu.CardWithScrollable>
            <Menu.Section>
              {seasons.map((number) => (
                <Menu.ChevronLink
                  key={number}
                  onClick={() => {
                    setSeason(number);
                    router.navigate("/episodes");
                  }}
                >
                  Season {number}
                </Menu.ChevronLink>
              ))}
            </Menu.Section>
          </Menu.CardWithScrollable>
        </OverlayPage>
        <OverlayPage
          id="episodes"
          path="/episodes"
          width={343}
          height={compact || window.innerWidth < 1024 ? 431 : 375}
          fullWidth={!compact}
        >
          <Menu.CardWithScrollable>
            <Menu.BackLink onClick={() => router.navigate("/")}>
              Season {season}
            </Menu.BackLink>
            <div
              className={
                compact
                  ? "px-6 pb-5"
                  : "flex flex-col lg:flex-row gap-3 p-4 overflow-auto"
              }
            >
              {episodes
                .filter(
                  (episode) => (episode.ParentIndexNumber ?? 0) === season,
                )
                .map((episode) => (
                  <button
                    type="button"
                    key={episode.Id}
                    onClick={() => {
                      router.close();
                      playItem(episode.Id);
                    }}
                    className={`${compact ? "flex py-3 w-full" : "text-left flex lg:block flex-shrink-0 lg:w-64 rounded-lg overflow-hidden"} transition-colors ${itemId === episode.Id ? "bg-video-context-hoverColor/50" : "hover:bg-video-context-hoverColor/50"}`}
                  >
                    {!compact ? (
                      <img
                        src={jellyfinUrl(
                          `/Items/${episode.Id}/Images/Primary`,
                          { maxWidth: 500 },
                        )}
                        alt=""
                        className="w-1/3 lg:w-full aspect-video object-cover bg-video-context-hoverColor"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="p-3">
                      <span className="text-xs text-type-secondary">
                        S{episode.ParentIndexNumber}E{episode.IndexNumber}
                        {episode.UserData?.Played ? " · Watched" : ""}
                      </span>
                      <h3 className="font-bold text-white line-clamp-1">
                        {episode.Name}
                      </h3>
                      {!compact ? (
                        <p className="text-sm text-white/80 mt-1.5 line-clamp-2">
                          {episode.Overview}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
            </div>
          </Menu.CardWithScrollable>
        </OverlayPage>
      </OverlayRouter>
    </Overlay>
  );
}

export function JellyfinInfoButton() {
  const meta = usePlayerStore((state) => state.meta);
  const [open, setOpen] = useState(false);
  const setHasOpenOverlay = usePlayerStore((state) => state.setHasOpenOverlay);
  useEffect(() => {
    setHasOpenOverlay(open);
    return () => setHasOpenOverlay(false);
  }, [open, setHasOpenOverlay]);
  if (!meta?.jellyfinItemId) return null;
  return (
    <>
      <VideoPlayerButton
        icon={Icons.CIRCLE_QUESTION}
        iconSizeClass="text-base"
        className="p-2 !-mr-2 relative z-10"
        onClick={() => setOpen(true)}
      />
      <JellyfinDetailsModal
        itemId={
          open
            ? getJellyfinDetailsId({
                Id: meta.jellyfinItemId,
                Type:
                  meta.jellyfinSeriesId || meta.episode ? "Episode" : "Movie",
                SeriesId: meta.jellyfinSeriesId,
              })
            : undefined
        }
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function JellyfinNextEpisode({
  controlsShowing,
  compact = false,
}: {
  controlsShowing: boolean;
  compact?: boolean;
}) {
  const { episodes, itemId, playItem } = useJellyfinPlayback();
  const time = usePlayerStore((state) => state.progress.time);
  const duration = usePlayerStore((state) => state.progress.duration);
  const status = usePlayerStore((state) => state.status);
  const autoplay = usePreferencesStore((state) => state.enableAutoplay);
  const advanced = useRef(false);
  const index = episodes.findIndex((episode) => episode.Id === itemId);
  const next = index >= 0 ? episodes[index + 1] : undefined;
  useEffect(() => {
    advanced.current = false;
  }, [itemId]);
  useEffect(() => {
    if (
      !compact &&
      autoplay &&
      next &&
      duration > 0 &&
      time >= duration - 0.5 &&
      !advanced.current
    ) {
      advanced.current = true;
      playItem(next.Id, true);
    }
  }, [compact, autoplay, next, time, duration, playItem]);
  if (!next) return null;
  if (compact)
    return (
      <VideoPlayerButton
        icon={Icons.SKIP_EPISODE}
        iconSizeClass="text-xl"
        onClick={() => playItem(next.Id, true)}
      />
    );
  const show =
    status === "playing" &&
    duration > 0 &&
    (duration - time <= 30 || (time / duration >= 0.93 && controlsShowing));
  return (
    <Transition
      animation="fade"
      show={show}
      className="absolute right-[calc(3rem+env(safe-area-inset-right))] bottom-0"
    >
      <div
        className={`absolute right-0 transition-[bottom] duration-200 flex items-center space-x-3 ${controlsShowing ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]" : "bottom-[calc(3rem+env(safe-area-inset-bottom))]"}`}
      >
        <button
          type="button"
          className="font-bold rounded h-10 w-40 scale-95 hover:scale-100 transition-all duration-200 bg-buttons-secondary hover:bg-buttons-secondaryHover text-buttons-secondaryText"
          onClick={() => {
            usePlayerStore.getState().display?.setTime(0);
            usePlayerStore.getState().display?.play();
          }}
        >
          Replay
        </button>
        <button
          type="button"
          className="font-bold rounded h-10 w-40 scale-95 hover:scale-100 transition-all duration-200 bg-buttons-primary hover:bg-buttons-primaryHover text-buttons-primaryText flex justify-center items-center"
          onClick={() => playItem(next.Id, true)}
        >
          <Icon className="text-xl mr-1" icon={Icons.SKIP_EPISODE} />
          Next episode
        </button>
      </div>
    </Transition>
  );
}

export function JellyfinBookmarkButton() {
  const meta = usePlayerStore((state) => state.meta);
  const itemId = meta?.jellyfinSeriesId ?? meta?.jellyfinItemId;
  const [favorite, setFavoriteState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (itemId)
      getItem(itemId)
        .then((item) => {
          if (active) setFavoriteState(!!item.UserData?.IsFavorite);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [itemId]);
  const toggle = async () => {
    if (!itemId || busy) return;
    setBusy(true);
    setError("");
    try {
      await setFavorite(itemId, !favorite);
      setFavoriteState(!favorite);
    } catch {
      setError("Could not update your Jellyfin favourites.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span
      title={
        error || (favorite ? "Remove from favourites" : "Add to favourites")
      }
    >
      <VideoPlayerButton
        icon={favorite ? Icons.BOOKMARK : Icons.BOOKMARK_OUTLINE}
        iconSizeClass="text-base"
        className="p-2"
        onClick={toggle}
      />
    </span>
  );
}
