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
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { useRetainedModalValue } from "@/components/overlays/DetailsModalFrame";
import { copyText } from "@/utils/copyText";

function DownloadPanel({
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
    <div className="space-y-6">
      {!allowed ? (
        <p role="alert" className="text-type-secondary">
          Downloads are unavailable for this account.
        </p>
      ) : (
        <>
          {item.MediaSources?.length ? (
            <label className="block text-sm text-type-secondary space-y-2">
              <span>Version</span>
              <select
                value={source?.Id}
                onChange={(event) => chooseVersion(event.target.value)}
                className="tabbable w-full rounded-xl bg-dropdown-background p-3 text-white"
              >
                {item.MediaSources.map((entry) => (
                  <option key={entry.Id} value={entry.Id}>
                    {mediaSourceLabel(entry)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <section className="space-y-3">
            <h3 className="font-semibold text-white">Original file</h3>
            <p className="text-sm break-all text-type-secondary">
              {downloadFileName(item, source)}
            </p>
            <p className="text-sm text-type-secondary">
              {source?.Container?.toUpperCase() ?? "Original format"} ·{" "}
              {downloadSize(source?.Size)}
            </p>
            {original ? (
              <a
                href={original}
                download={downloadFileName(item, source)}
                className="tabbable inline-flex items-center gap-2 rounded-lg bg-buttons-cancel py-2 px-4 text-white hover:bg-buttons-cancelHover"
              >
                <Icon icon={Icons.DOWNLOAD} />
                Download original file
              </a>
            ) : (
              <p className="text-sm text-type-secondary">
                This source is available as a stream. Jellyfin does not expose a
                downloadable original file.
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold text-white">Stream link</h3>
            <p className="text-sm text-type-secondary">
              Open the selected version in a compatible media player. This
              private link includes your Jellyfin sign-in token.
            </p>
            <Button theme="secondary" padding="px-4 py-2" onClick={copy}>
              Copy stream URL
            </Button>
            {error.includes("copy manually") ||
            error.includes("copy it manually") ? (
              <textarea
                aria-label="Private stream URL"
                readOnly
                value={downloadStreamUrl(item, source)}
                onFocus={(event) => event.target.select()}
                className="tabbable w-full h-24 rounded-xl bg-dropdown-background p-3 text-sm text-white break-all"
              />
            ) : null}
          </section>
          {subtitles.length ? (
            <section className="space-y-3">
              <h3 className="font-semibold text-white">Text subtitles</h3>
              <div className="flex gap-2">
                <select
                  aria-label="Subtitle to download"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  className="tabbable min-w-0 flex-1 rounded-xl bg-dropdown-background p-3 text-white"
                >
                  {subtitles.map((track) => (
                    <option key={track.Index} value={track.Index}>
                      {track.DisplayTitle ??
                        track.Language ??
                        `Subtitle ${track.Index}`}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Subtitle file format"
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as "srt" | "vtt")
                  }
                  className="tabbable rounded-xl bg-dropdown-background p-3 text-white"
                >
                  <option value="srt">SRT</option>
                  <option value="vtt">WebVTT</option>
                </select>
              </div>
              <Button
                theme="secondary"
                padding="px-4 py-2"
                disabled={busy}
                onClick={saveSubtitle}
              >
                {busy ? "Preparing subtitle…" : "Download subtitle"}
              </Button>
              <p className="text-xs text-type-secondary">
                Exported as UTF-8. Image-based subtitles stay embedded in the
                original video.
              </p>
            </section>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-white">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-type-danger">
              {error}
            </p>
          ) : null}
          <details className="text-sm text-type-secondary">
            <summary className="tabbable cursor-pointer font-medium text-white">
              Download help
            </summary>
            <select
              aria-label="Download device"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="tabbable w-full rounded-xl bg-dropdown-background p-3 text-white mt-3"
            >
              <option value="desktop">Computer</option>
              <option value="ios">iPhone or iPad</option>
              <option value="android">Android</option>
            </select>
            <p className="mt-3">
              {platform === "ios"
                ? "Use Safari's download button or the Share menu and Save to Files. Large files may need free local storage. Open the saved video and subtitle together in a compatible player."
                : platform === "android"
                  ? "Find saved files in your browser's Downloads or the Files app. A compatible media player can open the private stream URL and load the downloaded subtitle."
                  : "Your browser saves the original file to its Downloads folder. If it opens a video tab, use the browser's Save video action. Put the subtitle beside the video or select it in your media player."}
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
