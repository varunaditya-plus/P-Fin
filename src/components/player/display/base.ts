import fscreen from "fscreen";
import Hls from "hls.js";

import {
  DisplayInterface,
  DisplayInterfaceEvents,
} from "@/components/player/display/displayInterface";
import { interceptPlayback } from "@/components/player/remote/playbackCommands";
import { handleBuffered } from "@/components/player/utils/handleBuffered";
import { getMediaErrorDetails } from "@/components/player/utils/mediaErrorDetails";
import { LoadableSource, SourceQuality } from "@/stores/player/utils/qualities";
import {
  canChangeVolume,
  canFullscreen,
  canFullscreenAnyElement,
  canPictureInPicture,
  canPlayHlsNatively,
  canWebkitFullscreen,
  canWebkitPictureInPicture,
} from "@/utils/detectFeatures";
import { makeEmitter } from "@/utils/events";

import { createAudioBoost } from "./audioBoost";
import {
  highestHlsLevel,
  hlsLevelToQuality,
  hlsLevelsToQualities,
  manualHlsLevel,
} from "./hlsQuality";
import {
  DEFAULT_VIDEO_APPEARANCE,
  VideoAppearance,
  normalizeVideoAppearance,
  videoAppearanceFilter,
} from "./videoAppearance";

export function makeVideoElementDisplayInterface(): DisplayInterface {
  const { emit, on, off } = makeEmitter<DisplayInterfaceEvents>();
  const audioBoost = createAudioBoost();
  let source: LoadableSource | null = null;
  let hls: Hls | null = null;
  let videoSourceEvents: AbortController | null = null;
  let videoElement: HTMLVideoElement | null = null;
  let containerElement: HTMLElement | null = null;
  let isFullscreen = false;
  let isPictureInPicture = false;
  let isPausedBeforeSeeking = false;
  let isSeeking = false;
  let startAt = 0;
  let automaticQuality = false;
  let preferenceQuality: SourceQuality | null = null;
  let lastVolume = 1;
  let lastPlaybackRate = 1;
  let videoAppearance: VideoAppearance = { ...DEFAULT_VIDEO_APPEARANCE };
  let lastValidDuration = 0; // Store the last valid duration to prevent reset during source switches
  let lastValidTime = 0; // Store the last valid time to prevent reset during source switches
  let shouldAutoplayAfterLoad = false; // Flag to track if we should autoplay after loading completes

  function reportLevels() {
    if (!hls) return;
    emit("qualities", hlsLevelsToQualities(hls.levels));
  }

  function setupQualityForHls() {
    if (!hls) return;
    if (automaticQuality) {
      hls.currentLevel = -1;
      hls.loadLevel = -1;
      // Some manifests omit resolution entirely. Seed a concrete usable level
      // while keeping subsequent bandwidth adaptation enabled.
      if (hls.levels.every((level) => hlsLevelToQuality(level) === "unknown")) {
        hls.startLevel = highestHlsLevel(hls.levels);
      }
      return;
    }
    const level = manualHlsLevel(
      hls.levels,
      preferenceQuality,
      hls.currentLevel,
    );
    if (level >= 0) {
      hls.currentLevel = level;
      hls.loadLevel = level;
    }
  }

  function setupSource(vid: HTMLVideoElement, src: LoadableSource) {
    hls?.destroy();
    hls = null;
    if (src.type === "hls") {
      if (canPlayHlsNatively(vid)) {
        vid.src = src.url;
        vid.currentTime = startAt;
        return;
      }

      if (!Hls.isSupported())
        throw new Error("HLS not supported. Update your browser. 🤦‍♂️");
      if (!hls) {
        hls = new Hls({
          autoStartLoad: true,
          startPosition: startAt,
          maxBufferLength: 120, // 120 seconds
          maxMaxBufferLength: 240,
          abrEwmaDefaultEstimate: 5 * 1000 * 1000, // 5 Mbps default bandwidth estimate for better ABR decisions
          fragLoadPolicy: {
            default: {
              maxLoadTimeMs: 30 * 1000, // allow it load extra long, fragments are slow if requested for the first time on an origin
              maxTimeToFirstByteMs: 30 * 1000,
              errorRetry: {
                maxNumRetry: 10,
                retryDelayMs: 1000,
                maxRetryDelayMs: 10000,
              },
              timeoutRetry: {
                maxNumRetry: 10,
                maxRetryDelayMs: 0,
                retryDelayMs: 0,
              },
            },
          },
          renderTextTracksNatively: false,
        });
        const exceptions = [
          "Failed to execute 'appendBuffer' on 'SourceBuffer': This SourceBuffer has been removed from the parent media source.",
        ];
        hls?.on(Hls.Events.ERROR, (_event, data) => {
          console.error(
            "HLS error",
            data.details,
            `fatal=${data.fatal}`,
            `status=${data.response?.code ?? "unknown"}`,
          );

          // Extract detailed HLS error information
          const hlsErrorInfo = {
            details: data.details,
            fatal: data.fatal,
            level: data.level,
            levelDetails: (data as any).levelDetails
              ? {
                  url: (data as any).levelDetails.url,
                  width: (data as any).levelDetails.width,
                  height: (data as any).levelDetails.height,
                  bitrate: (data as any).levelDetails.bitrate,
                }
              : undefined,
            frag: data.frag
              ? {
                  url: data.frag.url,
                  baseurl: data.frag.baseurl,
                  duration: data.frag.duration,
                  start: data.frag.start,
                  sn: data.frag.sn,
                }
              : undefined,
            type: data.type,
            url: (data as any).url,
          };

          if (data.fatal && !exceptions.includes(data.error?.message ?? "")) {
            emit("error", {
              message:
                data.error?.message ?? "The video stream could not be loaded",
              stackTrace: data.error?.stack,
              errorName: data.error?.name ?? "HlsError",
              type: "hls",
              hls: hlsErrorInfo,
            });
          }
        });
        hls.on(Hls.Events.MANIFEST_LOADED, () => {
          if (!hls) return;
          reportLevels();
          setupQualityForHls();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          if (!hls) return;

          const currentLevel = hls.levels[hls.currentLevel];
          emit("changedquality", hlsLevelToQuality(currentLevel));
        });
      }

      hls.attachMedia(vid);
      hls.loadSource(src.url);
      vid.currentTime = startAt;
      return;
    }

    vid.src = src.url;
    vid.currentTime = startAt;
  }

  function webkitPresentationModeChange() {
    if (!videoElement) return;
    const webkitPlayer = videoElement as any;
    const isInWebkitPip =
      webkitPlayer.webkitPresentationMode === "picture-in-picture";
    isPictureInPicture = isInWebkitPip;
    // Use native tracks in WebKit PiP mode for iOS compatibility
    emit("needstrack", isInWebkitPip);

    // On iOS, entering PiP may allow autoplay that was previously blocked
    if (isInWebkitPip && videoElement.paused && shouldAutoplayAfterLoad) {
      shouldAutoplayAfterLoad = false;
      videoElement.play().catch(() => {
        // If still blocked, emit pause to show play button
        emit("pause", undefined);
      });
    }
  }

  function addVideoListener(event: string, listener: EventListener) {
    videoElement?.addEventListener(event, listener, {
      signal: videoSourceEvents?.signal,
    });
  }

  function setSource() {
    if (!videoElement || !source) return;
    videoSourceEvents?.abort();
    videoSourceEvents = new AbortController();
    videoElement.autoplay = shouldAutoplayAfterLoad;
    videoElement.defaultPlaybackRate = lastPlaybackRate;
    setupSource(videoElement, source);
    videoElement.playbackRate = lastPlaybackRate;

    addVideoListener("play", () => {
      emit("play", undefined);
      emit("loading", false);
    });
    addVideoListener("error", () => {
      const err = videoElement?.error ?? null;
      const errorDetails = getMediaErrorDetails(err);
      emit("error", {
        errorName: errorDetails.name,
        key: errorDetails.key,
        type: "htmlvideo",
      });
    });
    addVideoListener("playing", () => {
      emit("play", undefined);
      emit("loading", false);
    });
    addVideoListener("pause", () => emit("pause", undefined));
    addVideoListener("ended", () => emit("ended", undefined));
    addVideoListener("canplay", () => {
      emit("loading", false);

      // Attempt autoplay if this was an autoplay transition (startAt = 0)
      if (shouldAutoplayAfterLoad && startAt === 0 && videoElement) {
        shouldAutoplayAfterLoad = false; // Reset the flag
        // Try to play - this will work on most platforms, but iOS may block it
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Autoplay succeeded
            })
            .catch((_error) => {
              // Play was blocked (likely iOS), emit that we're not playing
              // The AutoPlayStart component will show a play button
              emit("pause", undefined);
            });
        }
      }
    });
    addVideoListener("waiting", () => emit("loading", true));
    addVideoListener("volumechange", () =>
      emit(
        "volumechange",
        videoElement?.muted ? 0 : (videoElement?.volume ?? 0),
      ),
    );
    addVideoListener("timeupdate", () => {
      const currentTime = videoElement?.currentTime ?? 0;
      // Always emit time updates when seeking to prevent subtitle freezing
      // Also emit when progressing forward or when time changes significantly
      // This prevents time from resetting to 0 during source switches
      if (
        currentTime >= lastValidTime ||
        isSeeking ||
        Math.abs(currentTime - lastValidTime) > 0.1
      ) {
        lastValidTime = currentTime;
        emit("time", currentTime);
      }
    });
    addVideoListener("loadedmetadata", () => {
      if (videoElement && startAt > 0) {
        videoElement.currentTime = startAt;
        startAt = 0;
      }
      if (
        source?.type === "hls" &&
        videoElement &&
        canPlayHlsNatively(videoElement)
      ) {
        emit("qualities", ["unknown"]);
        emit("changedquality", "unknown");
      }
      // Only emit duration if it's a valid value (> 0) to prevent progress reset during source switches
      const duration = videoElement?.duration ?? 0;
      if (duration > 0) {
        lastValidDuration = duration;
        emit("duration", duration);
      } else if (lastValidDuration > 0) {
        // Keep the last valid duration if the new one is invalid
        emit("duration", lastValidDuration);
      }
    });
    addVideoListener("progress", () => {
      if (videoElement) {
        const bufferedTime = handleBuffered(
          videoElement.currentTime,
          videoElement.buffered,
        );
        emit("buffered", bufferedTime);

        // Check if we now have enough buffer to stop loading
        const hasEnoughBuffer = (() => {
          const buffered = videoElement.buffered;
          if (buffered.length === 0) return false;

          const currentTime = videoElement.currentTime ?? 0;
          // Find the buffered range that contains current time
          for (let i = 0; i < buffered.length; i += 1) {
            if (
              currentTime >= buffered.start(i) &&
              currentTime <= buffered.end(i)
            ) {
              const bufferedAhead = buffered.end(i) - currentTime;
              return bufferedAhead >= 5; // At least 5 seconds buffered ahead
            }
          }
          return false;
        })();

        // If we're still loading but now have enough buffer, stop loading
        // This handles cases where canplay fired with insufficient buffer
        if (hasEnoughBuffer && videoElement.readyState >= 3) {
          emit("loading", false);
        }
      }
    });
    addVideoListener("webkitendfullscreen", () => {
      isFullscreen = false;
      emit("fullscreen", isFullscreen);
      if (!isFullscreen) emit("needstrack", false);
    });
    addVideoListener("webkitplaybacktargetavailabilitychanged", (e: any) => {
      if (e.availability === "available") {
        emit("canairplay", true);
      }
    });
    addVideoListener(
      "webkitpresentationmodechanged",
      webkitPresentationModeChange,
    );
    addVideoListener("ratechange", () => {
      if (videoElement) emit("playbackrate", videoElement.playbackRate);
    });

    addVideoListener("durationchange", () => {
      // Only emit duration if it's a valid value (> 0) to prevent progress reset during source switches
      const duration = videoElement?.duration ?? 0;
      if (duration > 0) {
        lastValidDuration = duration;
        emit("duration", duration);
      } else if (lastValidDuration > 0) {
        // Keep the last valid duration if the new one is invalid
        emit("duration", lastValidDuration);
      }
    });
  }

  function unloadSource() {
    videoSourceEvents?.abort();
    videoSourceEvents = null;
    // Clear any pending quality change timeout

    if (videoElement) {
      videoElement.removeAttribute("src");
      videoElement.load();
    }
    if (hls) {
      hls.destroy();
      hls = null;
    }
    // Reset the last valid duration and time when unloading source
    lastValidDuration = 0;
    lastValidTime = 0;
  }

  function destroyVideoElement() {
    unloadSource();
    audioBoost.destroy();
    if (videoElement) {
      videoElement = null;
    }
    // Clear any remaining timeout
  }

  function fullscreenChange() {
    isFullscreen =
      !!document.fullscreenElement || // other browsers
      !!(document as any).webkitFullscreenElement; // safari
    emit("fullscreen", isFullscreen);
    if (!isFullscreen) emit("needstrack", false);

    // On iOS, entering fullscreen may allow autoplay that was previously blocked
    if (
      isFullscreen &&
      videoElement &&
      videoElement.paused &&
      shouldAutoplayAfterLoad
    ) {
      shouldAutoplayAfterLoad = false;
      videoElement.play().catch(() => {
        // If still blocked, emit pause to show play button
        emit("pause", undefined);
      });
    }
  }
  fscreen.addEventListener("fullscreenchange", fullscreenChange);

  function pictureInPictureChange() {
    isPictureInPicture = !!document.pictureInPictureElement;
    // Use native tracks in PiP mode for better compatibility with iOS and other platforms
    emit("needstrack", isPictureInPicture);

    // Entering PiP may allow autoplay that was previously blocked
    if (
      isPictureInPicture &&
      videoElement &&
      videoElement.paused &&
      shouldAutoplayAfterLoad
    ) {
      shouldAutoplayAfterLoad = false;
      videoElement.play().catch(() => {
        // If still blocked, emit pause to show play button
        emit("pause", undefined);
      });
    }
  }

  document.addEventListener("enterpictureinpicture", pictureInPictureChange);
  document.addEventListener("leavepictureinpicture", pictureInPictureChange);

  return {
    on,
    off,
    destroy: () => {
      destroyVideoElement();
      fscreen.removeEventListener("fullscreenchange", fullscreenChange);
      document.removeEventListener(
        "enterpictureinpicture",
        pictureInPictureChange,
      );
      document.removeEventListener(
        "leavepictureinpicture",
        pictureInPictureChange,
      );
    },
    load(ops) {
      if (!ops.source) unloadSource();
      automaticQuality = ops.automaticQuality;
      preferenceQuality = ops.preferredQuality;
      source = ops.source;
      emit("loading", true);
      startAt = ops.startAt;
      // Set autoplay flag if starting from beginning (indicates autoplay transition)
      shouldAutoplayAfterLoad = ops.autoplay ?? true;
      setSource();
    },
    processVideoElement(video) {
      destroyVideoElement();
      videoElement = video;
      audioBoost.attach(video);
      videoElement.style.filter = videoAppearanceFilter(videoAppearance);
      setSource();
      this.setVolume(lastVolume);
    },
    processContainerElement(container) {
      containerElement = container;
    },
    pause() {
      if (interceptPlayback("pause")) return;
      videoElement?.pause();
    },
    play() {
      if (interceptPlayback("play")) return;
      const video = videoElement;
      video?.play()?.catch(() => {
        if (video === videoElement) emit("pause", undefined);
      });
    },
    setSeeking(active) {
      if (active === isSeeking) return;
      isSeeking = active;

      // if it was playing when starting to seek, play again
      if (!active) {
        if (!isPausedBeforeSeeking) this.play();
        return;
      }

      isPausedBeforeSeeking = videoElement?.paused ?? true;
      this.pause();
    },
    setTime(t) {
      if (interceptPlayback("seek", t)) return;
      if (!videoElement) return;
      // clamp time between 0 and max duration
      let time = Math.min(t, videoElement.duration);
      time = Math.max(0, time);

      if (Number.isNaN(time)) return;
      emit("time", time);
      videoElement.currentTime = time;
    },
    async setVolume(v) {
      // clamp time between 0 and 1
      let volume = Math.min(v, 1);
      volume = Math.max(0, volume);

      // actually set
      lastVolume = volume;
      if (!videoElement) return;
      videoElement.muted = volume === 0; // Muted attribute is always supported

      // update state
      const isChangeable = await canChangeVolume();
      if (!videoElement) return;
      if (isChangeable) {
        videoElement.volume = lastVolume;
      } else {
        // For browsers where it can't be changed
        emit("volumechange", lastVolume === 0 ? 0 : 1);
      }
    },
    toggleFullscreen() {
      if (isFullscreen) {
        isFullscreen = false;
        emit("fullscreen", isFullscreen);
        emit("needstrack", false);
        if (!fscreen.fullscreenElement) return;
        fscreen.exitFullscreen();
        return;
      }

      // enter fullscreen
      isFullscreen = true;
      emit("fullscreen", isFullscreen);
      if (!canFullscreen() || fscreen.fullscreenElement) return;
      if (canFullscreenAnyElement()) {
        if (containerElement) fscreen.requestFullscreen(containerElement);
        return;
      }
      if (canWebkitFullscreen()) {
        if (videoElement) {
          emit("needstrack", true);
          (videoElement as any).webkitEnterFullscreen();
        }
      }
    },
    togglePictureInPicture() {
      if (!videoElement) return;
      if (canWebkitPictureInPicture()) {
        const webkitPlayer = videoElement as any;
        webkitPlayer.webkitSetPresentationMode(
          webkitPlayer.webkitPresentationMode === "picture-in-picture"
            ? "inline"
            : "picture-in-picture",
        );
      }
      if (canPictureInPicture()) {
        if (videoElement !== document.pictureInPictureElement) {
          videoElement.requestPictureInPicture();
        } else {
          document.exitPictureInPicture();
        }
      }
    },
    startAirplay() {
      const videoPlayer = videoElement as HTMLVideoElement & {
        webkitShowPlaybackTargetPicker?: () => void;
      };
      videoPlayer?.webkitShowPlaybackTargetPicker?.();
    },
    setVolumeBoost(multiplier) {
      return audioBoost.setBoost(multiplier);
    },
    setVideoAppearance(appearance) {
      videoAppearance = normalizeVideoAppearance(appearance);
      if (videoElement)
        videoElement.style.filter = videoAppearanceFilter(videoAppearance);
    },
    setPlaybackRate(rate) {
      if (!Number.isFinite(rate) || rate <= 0) return;
      lastPlaybackRate = rate;
      if (videoElement) {
        videoElement.defaultPlaybackRate = rate;
        videoElement.playbackRate = rate;
      }
    },
  };
}
