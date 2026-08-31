import { useEffect, useState } from "react";

import {
  ContentImage,
  ContentItem,
  RemoteImage,
  RemoteSubtitle,
  contentImageUrl,
  deleteContentImage,
  deleteContentSubtitle,
  downloadContentSubtitle,
  getContentImages,
  getRemoteImages,
  safeExternalUrl,
  saveRemoteImage,
  searchContentSubtitles,
  uploadContentImage,
  uploadContentSubtitle,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";
import { Spinner } from "@/components/layout/Spinner";

import {
  ContentCheckbox,
  ContentField,
  contentInputClass,
} from "./ContentMetadataEditor";

function errorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "Jellyfin could not complete this action.";
}

export function ContentImageEditor({
  item,
  onSaved,
}: {
  item: ContentItem;
  onSaved: () => Promise<void>;
}) {
  const [images, setImages] = useState<ContentImage[]>([]);
  const [remote, setRemote] = useState<RemoteImage[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [type, setType] = useState("Primary");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState<ContentImage | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getContentImages(item.Id, controller.signal)
      .then(setImages)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [item.Id]);
  const change = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    let changed = false;
    try {
      await action();
      changed = true;
      setRemove(null);
      await onSaved();
      setImages(await getContentImages(item.Id));
      setMessage(success);
    } catch (reason) {
      setError(
        changed
          ? `${success} The updated images could not be reloaded. Close and reopen this editor to refresh them.`
          : errorMessage(reason),
      );
    } finally {
      setBusy(false);
    }
  };
  const search = async (more = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    if (!more) {
      setRemote([]);
      setTotal(0);
      setSearched(false);
    }
    try {
      const result = await getRemoteImages(
        item.Id,
        type,
        more ? remote.length : 0,
      );
      setRemote((current) =>
        more ? [...current, ...result.Images] : result.Images,
      );
      setTotal(result.TotalRecordCount);
      setSearched(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      {loading ? <Spinner /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={`${image.ImageType}-${image.ImageIndex}`}
            className="space-y-2"
          >
            <img
              src={contentImageUrl(
                item.Id,
                image.ImageType,
                image.ImageIndex,
                image.ImageTag,
              )}
              alt={image.ImageType}
              className="w-full h-36 object-contain bg-background-secondary rounded-lg"
            />
            <p className="text-sm text-white">
              {image.ImageType}
              {image.Width && image.Height
                ? ` · ${image.Width} × ${image.Height}`
                : ""}
            </p>
            <Button
              theme="secondary"
              padding="px-3 py-2"
              disabled={busy}
              onClick={() => setRemove(image)}
            >
              Delete image
            </Button>
          </div>
        ))}
      </div>
      {remove ? (
        <div
          role="alertdialog"
          aria-label="Delete image"
          className="border border-red-400/30 rounded-lg p-4 space-y-3"
        >
          <p className="text-sm text-white">
            Delete this {remove.ImageType.toLowerCase()} image from Jellyfin?
          </p>
          <div className="flex gap-3">
            <Button
              theme="danger"
              loading={busy}
              onClick={() =>
                change(
                  () => deleteContentImage(item.Id, remove),
                  "Image deleted.",
                )
              }
            >
              Delete image
            </Button>
            <Button
              theme="secondary"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ContentField label="Image type">
          <select
            className={contentInputClass}
            value={type}
            disabled={busy}
            onChange={(event) => {
              setType(event.target.value);
              setRemote([]);
              setTotal(0);
              setSearched(false);
              setError("");
            }}
          >
            {[
              "Primary",
              "Backdrop",
              "Logo",
              "Thumb",
              "Banner",
              "Art",
              "Disc",
              "Box",
              "BoxRear",
              "Menu",
              "Screenshot",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </ContentField>
        <ContentField label="Upload image">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={contentInputClass}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </ContentField>
      </div>
      <Button
        theme="purple"
        loading={busy}
        disabled={!file}
        onClick={() =>
          file &&
          change(
            () => uploadContentImage(item.Id, type, file),
            "Image uploaded.",
          )
        }
      >
        Upload image
      </Button>
      <details className="border border-white/10 rounded-lg p-4">
        <summary className="cursor-pointer text-white font-medium">
          Choose an image from Jellyfin&apos;s metadata providers
        </summary>
        <div className="space-y-4 mt-4">
          <Button theme="secondary" loading={busy} onClick={() => search()}>
            Search images
          </Button>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {remote
              .filter((image) => safeExternalUrl(image.Url))
              .map((image) => (
                <button
                  key={image.Url}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    change(
                      () => saveRemoteImage(item.Id, type, image.Url),
                      "Image saved.",
                    )
                  }
                  className="text-left space-y-2 hover:opacity-80 disabled:opacity-50"
                >
                  <img
                    src={safeExternalUrl(image.ThumbnailUrl) || image.Url}
                    alt={image.ProviderName || type}
                    loading="lazy"
                    className="h-36 w-full object-contain rounded-lg bg-background-secondary"
                  />
                  <p className="text-xs text-type-secondary">
                    {image.ProviderName} · {image.Width} × {image.Height}
                    {image.Language ? ` · ${image.Language}` : ""}
                  </p>
                </button>
              ))}
          </div>
          {searched && !remote.length ? (
            <p className="text-sm text-type-secondary">
              No images were returned by the configured providers.
            </p>
          ) : null}
          {remote.length < total ? (
            <Button
              theme="secondary"
              loading={busy}
              onClick={() => search(true)}
            >
              Load more images
            </Button>
          ) : null}
          <ContentField label="Or use an image URL">
            <input
              type="url"
              placeholder="https://"
              className={contentInputClass}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </ContentField>
          <Button
            theme="secondary"
            loading={busy}
            disabled={!safeExternalUrl(url)}
            onClick={() =>
              change(() => saveRemoteImage(item.Id, type, url), "Image saved.")
            }
          >
            Save image from URL
          </Button>
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-type-link">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ContentSubtitleEditor({
  item,
  canDelete,
  onSaved,
}: {
  item: ContentItem;
  canDelete: boolean;
  onSaved: () => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(
    item.MediaSources?.[0]?.Id ?? item.Id,
  );
  const source = item.MediaSources?.find((entry) => entry.Id === sourceId);
  const [language, setLanguage] = useState("eng");
  const [file, setFile] = useState<File | null>(null);
  const [forced, setForced] = useState(false);
  const [hearingImpaired, setHearingImpaired] = useState(false);
  const [perfect, setPerfect] = useState(true);
  const [results, setResults] = useState<RemoteSubtitle[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState<number | null>(null);
  // Alternate-version MediaSource IDs identify the actual video owning its
  // subtitles. Using the main item's ID would edit the wrong version.
  const targetId = source?.Id || item.Id;
  const change = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await onSaved();
      setMessage(success);
      setRemove(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  const search = async () => {
    setBusy(true);
    setError("");
    setResults([]);
    try {
      setResults(await searchContentSubtitles(targetId, language, perfect));
      setSearched(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      {(item.MediaSources?.length ?? 0) > 1 ? (
        <ContentField label="Version">
          <select
            className={contentInputClass}
            value={sourceId}
            disabled={busy}
            onChange={(event) => {
              setSourceId(event.target.value);
              setRemove(null);
              setResults([]);
              setSearched(false);
            }}
          >
            {item.MediaSources?.map((entry) => (
              <option key={entry.Id} value={entry.Id}>
                {entry.Name || entry.Id}
              </option>
            ))}
          </select>
        </ContentField>
      ) : null}
      <div className="space-y-2">
        {(source?.MediaStreams ?? item.MediaStreams)
          ?.filter((stream) => stream.Type === "Subtitle")
          .map((stream) => (
            <div
              key={stream.Index}
              className="flex flex-wrap items-center justify-between gap-3 bg-background-secondary/50 rounded-lg p-3"
            >
              <div>
                <p className="text-sm text-white">
                  {stream.DisplayTitle ||
                    stream.Title ||
                    stream.Language ||
                    `Subtitle ${stream.Index + 1}`}
                </p>
                <p className="text-xs text-type-secondary">
                  {stream.Codec?.toUpperCase()} ·{" "}
                  {stream.IsExternal ? "External" : "Embedded"}
                </p>
              </div>
              {canDelete && stream.IsExternal ? (
                <Button
                  theme="secondary"
                  padding="px-3 py-2"
                  disabled={busy}
                  onClick={() => setRemove(stream.Index)}
                >
                  Delete subtitle
                </Button>
              ) : null}
            </div>
          ))}
      </div>
      {remove !== null ? (
        <div
          role="alertdialog"
          aria-label="Delete subtitle"
          className="border border-red-400/30 rounded-lg p-4 space-y-3"
        >
          <p className="text-sm text-white">
            Delete this external subtitle file from Jellyfin?
          </p>
          <div className="flex gap-3">
            <Button
              theme="danger"
              loading={busy}
              onClick={() =>
                change(
                  () => deleteContentSubtitle(targetId, remove),
                  "Subtitle deleted.",
                )
              }
            >
              Delete subtitle
            </Button>
            <Button
              theme="secondary"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ContentField label="Language (three-letter code)">
          <input
            className={contentInputClass}
            value={language}
            placeholder="eng"
            maxLength={3}
            onChange={(event) => setLanguage(event.target.value.toLowerCase())}
          />
        </ContentField>
        <ContentField label="Upload subtitle">
          <input
            type="file"
            accept=".srt,.ass,.ssa,.vtt,.sub,.ttml"
            className={contentInputClass}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </ContentField>
      </div>
      <div className="flex flex-wrap gap-5">
        <ContentCheckbox label="Forced" checked={forced} onChange={setForced} />
        <ContentCheckbox
          label="Hearing impaired"
          checked={hearingImpaired}
          onChange={setHearingImpaired}
        />
      </div>
      <Button
        theme="purple"
        loading={busy}
        disabled={!file || !/^[a-z]{3}$/.test(language)}
        onClick={() =>
          file &&
          change(
            () =>
              uploadContentSubtitle(
                targetId,
                file,
                language,
                forced,
                hearingImpaired,
              ),
            "Subtitle uploaded. Jellyfin is refreshing the available tracks.",
          )
        }
      >
        Upload subtitle
      </Button>
      <details className="border border-white/10 rounded-lg p-4">
        <summary className="cursor-pointer text-white font-medium">
          Search Jellyfin&apos;s subtitle providers
        </summary>
        <div className="space-y-4 mt-4">
          <ContentCheckbox
            label="Only perfect matches"
            checked={perfect}
            onChange={setPerfect}
          />
          <Button theme="secondary" loading={busy} onClick={search}>
            Search subtitles
          </Button>
          {results.map((subtitle) => (
            <div
              key={subtitle.Id}
              className="flex flex-wrap gap-3 items-center justify-between bg-background-secondary/50 p-3 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm text-white break-words">
                  {subtitle.Name}
                </p>
                <p className="text-xs text-type-secondary">
                  {subtitle.ProviderName} · {subtitle.Format}
                  {subtitle.IsHashMatch ? " · Perfect match" : ""}
                  {subtitle.HearingImpaired ? " · Hearing impaired" : ""}
                </p>
              </div>
              <Button
                theme="secondary"
                disabled={busy}
                onClick={() =>
                  change(
                    () => downloadContentSubtitle(targetId, subtitle.Id),
                    "Subtitle download requested. Jellyfin will refresh the tracks when complete.",
                  )
                }
              >
                Download
              </Button>
            </div>
          ))}
          {searched && !results.length ? (
            <p className="text-sm text-type-secondary">
              No subtitles were returned by the configured providers.
            </p>
          ) : null}
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-type-link">
          {message}
        </p>
      ) : null}
    </div>
  );
}
