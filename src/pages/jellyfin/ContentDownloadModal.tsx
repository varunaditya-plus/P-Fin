import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";

import {
  ContentItem,
  ContentPolicy,
  contentPermissions,
} from "@/backend/jellyfin/content";
import {
  downloadFileName,
  downloadSize,
  downloadStreamUrl,
  downloadSubtitleFile,
  downloadableSubtitle,
  originalDownloadUrl,
  selectedDownloadSource,
} from "@/backend/jellyfin/downloads";
import { mediaSourceLabel } from "@/backend/jellyfin/mediaSourceLabel";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { useRetainedModalValue } from "@/components/overlays/DetailsModalFrame";
import { copyText } from "@/utils/copyText";

export function DownloadPanel({
  item,
  policy,
  sourceId,
  subtitleIndex,
}: {
  item: ContentItem;
  policy: ContentPolicy | null;
  sourceId?: string;
  subtitleIndex?: number;
}) {
  const [version, setVersion] = useState(sourceId);
  const source = selectedDownloadSource(item, version);
  const subtitles = source?.MediaStreams?.filter(downloadableSubtitle) ?? [];
  const [subtitle, setSubtitle] = useState(
    String(
      subtitles.find((entry) => entry.Index === subtitleIndex)?.Index ??
        subtitles[0]?.Index ??
        "",
    ),
  );
  const [format, setFormat] = useState<"srt" | "vtt">("srt");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController>();
  const [platform, setPlatform] = useState("desktop");
  useEffect(() => () => request.current?.abort(), []);
  const allowed = Boolean(policy && contentPermissions(item, policy).download);
  const original = allowed ? originalDownloadUrl(item, source) : undefined;
  const chooseVersion = (id: string) => {
    request.current?.abort();
    setBusy(false);
    setVersion(id);
    setMessage("");
    setError("");
    const next = selectedDownloadSource(item, id)?.MediaStreams?.find(
      downloadableSubtitle,
    );
    setSubtitle(String(next?.Index ?? ""));
  };
  const copy = async () => {
    setMessage("");
    setError("");
    if (!allowed) return;
    const copied = await copyText(downloadStreamUrl(item, source));
    if (copied) setMessage("Stream URL copied.");
    else
      setError("Could not copy. Select the stream URL and copy it manually.");
  };
  const saveSubtitle = async () => {
    const track = subtitles.find((entry) => entry.Index === Number(subtitle));
    if (!allowed || !source || !track || busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file = await downloadSubtitleFile(
        item,
        source,
        track,
        format,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", file.text], { type: file.contentType }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Subtitle download started.");
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not download subtitles.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {!allowed ? (
        <p role="alert" className="text-sm text-type-secondary py-4">
          Downloads are unavailable for this account.
        </p>
      ) : (
        <>
          {(item.MediaSources?.length ?? 0) > 1 ? (
            <div>
              <p className="text-xs text-video-context-type-secondary">
                Version
              </p>
              <Dropdown
                className="!my-2 w-full"
                selectedItem={{
                  id: source?.Id ?? "",
                  name: source ? mediaSourceLabel(source) : "Select a version",
                }}
                options={(item.MediaSources ?? []).map((entry) => ({
                  id: entry.Id,
                  name: mediaSourceLabel(entry),
                }))}
                setSelectedItem={(entry) => chooseVersion(entry.id)}
              />
            </div>
          ) : null}
          {original ? (
            <a
              href={original}
              download={downloadFileName(item, source)}
              className="tabbable flex items-center justify-between gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-video-context-light/20 transition-colors"
            >
              <span className="min-w-0 text-left">
                <span className="flex items-center gap-2 flex-wrap text-sm text-white font-medium">
                  Download original file
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 uppercase tracking-wide">
                    {source?.Container ?? "Original"}
                  </span>
                </span>
                <span className="block text-xs text-type-secondary mt-1">
                  {downloadSize(source?.Size)}
                </span>
                <span
                  className="block text-xs text-type-secondary/70 break-all line-clamp-2 mt-1"
                  title={downloadFileName(item, source)}
                >
                  {downloadFileName(item, source)}
                </span>
              </span>
              <Icon
                className="text-xl shrink-0 text-video-context-type-main"
                icon={Icons.DOWNLOAD}
              />
            </a>
          ) : (
            <p className="text-sm text-type-secondary py-3">
              Jellyfin does not expose an original file for this source.
            </p>
          )}
          <button
            type="button"
            onClick={copy}
            className="tabbable flex w-full items-center justify-between gap-3 py-3 text-left rounded-lg hover:bg-video-context-light/20 transition-colors"
          >
            <span>
              <span className="block text-sm text-white font-medium">
                Copy stream URL
              </span>
              <span className="block text-xs text-type-secondary mt-1">
                Open this version in another media player
              </span>
            </span>
            <Icon className="text-xl shrink-0" icon={Icons.LINK} />
          </button>
          <p className="text-xs text-type-secondary">
            The private stream link includes your Jellyfin sign-in token.
          </p>
          {error.includes("copy manually") ||
          error.includes("copy it manually") ? (
            <textarea
              aria-label="Private stream URL"
              readOnly
              value={downloadStreamUrl(item, source)}
              onFocus={(event) => event.target.select()}
              className="tabbable w-full h-24 rounded bg-video-context-inputBg p-3 text-sm text-white break-all"
            />
          ) : null}
          {subtitles.length ? (
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center gap-2">
                <Dropdown
                  className="!my-1 flex-1 min-w-0"
                  selectedItem={{
                    id: subtitle,
                    name:
                      subtitles.find(
                        (track) => String(track.Index) === subtitle,
                      )?.DisplayTitle ??
                      subtitles.find(
                        (track) => String(track.Index) === subtitle,
                      )?.Language ??
                      "Subtitle",
                  }}
                  options={subtitles.map((track) => ({
                    id: String(track.Index),
                    name:
                      track.DisplayTitle ??
                      track.Language ??
                      `Subtitle ${track.Index}`,
                  }))}
                  setSelectedItem={(choice) => setSubtitle(choice.id)}
                />
                <Dropdown
                  className="!my-1"
                  selectedItem={{
                    id: format,
                    name: format === "srt" ? "SRT" : "WebVTT",
                  }}
                  options={[
                    { id: "srt", name: "SRT" },
                    { id: "vtt", name: "WebVTT" },
                  ]}
                  setSelectedItem={(choice) =>
                    setFormat(choice.id as "srt" | "vtt")
                  }
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={saveSubtitle}
                className="tabbable flex items-center justify-between w-full gap-3 py-3 text-sm text-white font-medium rounded-lg hover:bg-video-context-light/20 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  {busy ? "Preparing subtitle…" : "Download subtitle"}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 uppercase tracking-wide">
                    {format}
                  </span>
                </span>
                <Icon icon={Icons.DOWNLOAD} className="text-xl" />
              </button>
            </div>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-video-context-type-accent">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-type-danger">
              {error}
            </p>
          ) : null}
          <details className="text-sm text-type-secondary border-t border-white/10 pt-3">
            <summary className="tabbable cursor-pointer text-video-context-type-main">
              Download help
            </summary>
            <Dropdown
              className="w-full"
              selectedItem={{
                id: platform,
                name:
                  platform === "ios"
                    ? "iPhone or iPad"
                    : platform === "android"
                      ? "Android"
                      : "Computer",
              }}
              options={[
                { id: "desktop", name: "Computer" },
                { id: "ios", name: "iPhone or iPad" },
                { id: "android", name: "Android" },
              ]}
              setSelectedItem={(choice) => setPlatform(choice.id)}
            />
            <p className="mt-3 text-xs">
              {platform === "ios"
                ? "Use Safari's download button or the Share menu and Save to Files. Open the saved video and subtitle together in a compatible player."
                : platform === "android"
                  ? "Find saved files in your browser's Downloads or the Files app. A compatible media player can open the private stream URL and load the downloaded subtitle."
                  : "Your browser saves the original file to its Downloads folder. If it opens a video tab, use the browser's Save video action. Put the subtitle beside the video or select it in your media player."}
            </p>
            <p className="mt-2 text-xs">
              Text subtitles use UTF-8. Image subtitles remain embedded in the
              original video.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

export function ContentDownloadModal({
  open,
  onClose,
  item,
  policy,
  sourceId,
  subtitleIndex,
}: {
  open: boolean;
  onClose: () => void;
  item: ContentItem;
  policy: ContentPolicy | null;
  sourceId?: string;
  subtitleIndex?: number;
}) {
  const presence = useRetainedModalValue(open ? item : undefined);
  if (!presence.value) return null;
  return (
    <Transition
      appear
      show={open}
      as={Fragment}
      afterLeave={presence.afterLeave}
    >
      <Dialog
        as="div"
        className="relative z-[1150]"
        onClose={onClose}
        aria-label="Download content"
      >
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-200 motion-reduce:transition-none"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-200 motion-reduce:transition-none"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <Transition.Child
            as={Fragment}
            enter="transition-[transform,opacity] duration-300 motion-reduce:transition-none"
            enterFrom="translate-y-4 opacity-0 motion-reduce:translate-y-0"
            enterTo="translate-y-0 opacity-100"
            leave="transition-[transform,opacity] duration-200 motion-reduce:transition-none"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-4 opacity-0 motion-reduce:translate-y-0"
          >
            <Dialog.Panel className="pointer-events-auto w-full max-w-xl max-h-[85dvh] flex flex-col rounded-3xl bg-modal-background border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-white/10">
                <div className="min-w-0">
                  <Dialog.Title className="text-xl font-semibold text-white">
                    Download
                  </Dialog.Title>
                  <p className="text-sm text-type-secondary mt-1 truncate">
                    {presence.value.Name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close downloads"
                  className="tabbable rounded-full bg-pill-background p-3 text-type-secondary hover:text-white"
                >
                  <Icon icon={Icons.X} />
                </button>
              </div>
              <div className="overflow-y-auto overscroll-contain p-5 md:p-6 scrollbar-thin">
                <DownloadPanel
                  key={presence.value.Id}
                  item={presence.value}
                  policy={policy}
                  sourceId={sourceId}
                  subtitleIndex={subtitleIndex}
                />
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
