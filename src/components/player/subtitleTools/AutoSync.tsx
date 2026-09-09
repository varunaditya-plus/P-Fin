import { useEffect, useRef } from "react";
import { create } from "zustand";

import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";

import { Alignment } from "./alignment";
import { capturePlaybackAudio } from "./capture";
import { useSubtitleTools } from "./preferences";
import { transcriptCues } from "./transcript";

const useSyncStatus = create<{
  message: string;
  busy: boolean;
  error: string;
  previous: number | null;
  cancel?: () => void;
}>(() => ({ message: "", busy: false, error: "", previous: null }));
export async function syncCurrentSubtitles() {
  if (useSyncStatus.getState().busy) return;
  const player = usePlayerStore.getState();
  const caption = player.caption.selected;
  const itemId = player.meta?.jellyfinItemId;
  const video = document.getElementById(
    "video-element",
  ) as HTMLVideoElement | null;
  if (!caption || !video) {
    useSyncStatus.setState({
      error: "Select a text subtitle track and start playback first.",
    });
    return;
  }
  const source = video.currentSrc;
  const controller = new AbortController();
  let worker: Worker | undefined;
  useSyncStatus.setState({
    busy: true,
    error: "",
    previous: null,
    message: "Listening to playback…",
    cancel: () => controller.abort(),
  });
  try {
    const cues = transcriptCues(caption.srtData).map(
      ({ start, end, text }) => ({ start, end, text }),
    );
    const audio = await capturePlaybackAudio(
      video,
      controller.signal,
      (percent) =>
        useSyncStatus.setState({
          message: `Listening to playback ${percent}%`,
        }),
    );
    controller.signal.throwIfAborted();
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    const alignment = await new Promise<Alignment>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>;
      let abort: () => void;
      const finish = () => {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      };
      abort = () => {
        finish();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      controller.signal.addEventListener("abort", abort, { once: true });
      timeout = setTimeout(() => {
        finish();
        reject(
          new Error(
            "Speech analysis took too long. Try a clearer dialogue scene.",
          ),
        );
      }, 180000);
      worker!.onerror = () => {
        finish();
        reject(new Error("The speech model could not start in this browser."));
      };
      worker!.onmessage = (
        event: MessageEvent<{
          status: string;
          progress?: number;
          alignment?: Alignment;
          error?: string;
        }>,
      ) => {
        if (event.data.status === "complete" && event.data.alignment) {
          finish();
          resolve(event.data.alignment);
        } else if (event.data.status === "error") {
          finish();
          reject(new Error(event.data.error));
        } else
          useSyncStatus.setState({
            message:
              event.data.status === "model"
                ? `Loading speech model ${event.data.progress ?? 0}%`
                : "Matching dialogue…",
          });
      };
      worker!.postMessage({ ...audio, cues }, [audio.pcm.buffer]);
    });
    if (
      controller.signal.aborted ||
      video.currentSrc !== source ||
      usePlayerStore.getState().caption.selected?.srtData !== caption.srtData ||
      usePlayerStore.getState().meta?.jellyfinItemId !== itemId
    )
      return;
    const previous = useSubtitleStore.getState().delay;
    useSubtitleStore.getState().setDelay(alignment.offset);
    useSyncStatus.setState({
      previous,
      message: `Applied ${alignment.offset.toFixed(2)}s delay from ${alignment.matches} matching lines (${Math.round(alignment.confidence * 100)}% confidence).`,
    });
  } catch (error) {
    if (!controller.signal.aborted)
      useSyncStatus.setState({
        error:
          error instanceof Error
            ? error.message
            : "Subtitle synchronisation failed.",
        message: "",
      });
    else useSyncStatus.setState({ message: "Cancelled; delay unchanged." });
  } finally {
    worker?.terminate();
    useSyncStatus.setState({ busy: false, cancel: undefined });
  }
}

export function SubtitleAutoSyncRuntime() {
  const enabled = useSubtitleTools((s) => s.autoSync);
  const caption = usePlayerStore((s) => s.caption.selected);
  const itemId = usePlayerStore((s) => s.meta?.jellyfinItemId);
  const played = usePlayerStore((s) => s.mediaPlaying.hasPlayedOnce);
  const attempted = useRef("");
  useEffect(() => {
    useSyncStatus.getState().cancel?.();
    useSyncStatus.setState({ previous: null, message: "", error: "" });
    return () => useSyncStatus.getState().cancel?.();
  }, [caption?.id, itemId]);
  useEffect(() => {
    const key = `${itemId}:${caption?.id}`;
    if (!enabled || !played || !caption || attempted.current === key) return;
    const timer = setTimeout(() => {
      attempted.current = key;
      syncCurrentSubtitles();
    }, 3000);
    return () => clearTimeout(timer);
  }, [enabled, played, caption, itemId]);
  return null;
}

export function SubtitleSyncView() {
  const router = useOverlayRouter("settings");
  const enabled = useSubtitleTools((s) => s.autoSync);
  const status = useSyncStatus();
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/captions")}>
        Subtitle synchronisation
      </Menu.BackLink>
      <Menu.Section className="space-y-4">
        <p className="text-sm text-type-secondary">
          Experimental: listen to 25 seconds of this video&apos;s dialogue and
          align matching subtitle lines. Audio stays in this browser. The first
          run downloads a speech model. Leave playback running at normal speed.
        </p>
        <label className="flex gap-3 items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) =>
              useSubtitleTools.setState({ autoSync: event.target.checked })
            }
          />{" "}
          Try automatically for each text track
        </label>
        <button
          className="tabbable w-full rounded-lg bg-video-context-light/10 p-3 disabled:opacity-40"
          type="button"
          disabled={status.busy}
          onClick={syncCurrentSubtitles}
        >
          Synchronise now
        </button>
        {status.busy ? (
          <button
            type="button"
            className="tabbable p-2"
            onClick={status.cancel}
          >
            Cancel
          </button>
        ) : null}
        {status.message ? (
          <p role="status" className="text-sm">
            {status.message}
          </p>
        ) : null}
        {status.error ? (
          <p role="alert" className="text-sm text-type-danger">
            {status.error}
          </p>
        ) : null}
        {status.previous !== null ? (
          <button
            type="button"
            className="tabbable p-2"
            onClick={() => {
              useSubtitleStore.getState().setDelay(status.previous!);
              useSyncStatus.setState({
                previous: null,
                message: "Previous delay restored.",
              });
            }}
          >
            Undo synchronisation
          </button>
        ) : null}
        <Menu.ChevronLink onClick={() => router.navigate("/captions/settings")}>
          Adjust delay manually
        </Menu.ChevronLink>
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
