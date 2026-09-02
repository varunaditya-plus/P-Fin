import { Transition } from "@headlessui/react";
import { useEffect, useId, useState } from "react";

import { getImageUrl } from "@/backend/jellyfin/client";
import {
  ContentItem,
  ContentSource,
  contentImageUrl,
  getLocalTrailers,
  getSpecialFeatures,
  safeExternalUrl,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";

import { isContentProviderUrl } from "./ContentProviderLinks";

export function chapterTime(ticks: number) {
  const seconds = Math.floor(ticks / 10000000);
  return `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function size(bytes?: number) {
  return bytes ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : undefined;
}
function rate(bitrate?: number) {
  return bitrate ? `${(bitrate / 1000000).toFixed(2)} Mbps` : undefined;
}
function MetadataRows({
  rows,
}: {
  rows: [string, string | number | undefined][];
}) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-5 gap-y-2 text-sm">
      {rows
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-type-secondary">{label}</dt>
            <dd className="text-white/90 break-words min-w-0">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
function MediaSourceInfo({ source }: { source: ContentSource }) {
  return (
    <div className="space-y-5">
      <MetadataRows
        rows={[
          ["Version", source.Name],
          ["Container", source.Container?.toUpperCase()],
          ["Size", size(source.Size)],
          ["Bitrate", rate(source.Bitrate)],
          [
            "Duration",
            source.RunTimeTicks ? chapterTime(source.RunTimeTicks) : undefined,
          ],
          ["Path", source.Path],
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {source.MediaStreams?.filter((stream) =>
          ["Video", "Audio", "Subtitle"].includes(stream.Type),
        ).map((stream) => (
          <div
            key={stream.Index}
            className="bg-background-secondary/50 rounded-lg p-4 space-y-3"
          >
            <h5 className="font-semibold text-white">
              {stream.Type} —{" "}
              {stream.DisplayTitle ||
                stream.Title ||
                `Track ${stream.Index + 1}`}
            </h5>
            <MetadataRows
              rows={[
                ["Codec", stream.Codec?.toUpperCase()],
                ["Language", stream.Language],
                ["Profile", stream.Profile],
                [
                  "Resolution",
                  stream.Width && stream.Height
                    ? `${stream.Width} × ${stream.Height}`
                    : undefined,
                ],
                ["Aspect ratio", stream.AspectRatio],
                ["Frame rate", stream.RealFrameRate ?? stream.AverageFrameRate],
                ["Bitrate", rate(stream.BitRate)],
                ["Bit depth", stream.BitDepth],
                [
                  "Video range",
                  stream.Type === "Video"
                    ? stream.VideoRangeType || stream.VideoRange
                    : undefined,
                ],
                ["Colour space", stream.ColorSpace],
                ["Pixel format", stream.PixelFormat],
                ["Channels", stream.ChannelLayout || stream.Channels],
                [
                  "Sample rate",
                  stream.SampleRate ? `${stream.SampleRate} Hz` : undefined,
                ],
                ["Default", stream.IsDefault ? "Yes" : undefined],
                ["Forced", stream.IsForced ? "Yes" : undefined],
                [
                  "Hearing impaired",
                  stream.IsHearingImpaired ? "Yes" : undefined,
                ],
                [
                  "Location",
                  stream.Type === "Subtitle"
                    ? stream.IsExternal
                      ? "External"
                      : "Embedded"
                    : undefined,
                ],
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
export function ContentInformation({
  item,
  playbackItem,
  sourceId,
  onPlay,
}: {
  item: ContentItem;
  playbackItem?: ContentItem | null;
  sourceId?: string;
  onPlay: (item: ContentItem, startTicks?: number) => void;
}) {
  const disclosureId = useId();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("Details");
  const [extras, setExtras] = useState<ContentItem[]>([]);
  const [trailers, setTrailers] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setExpanded(false);
    setTab("Details");
    setExtras([]);
    setTrailers([]);
    setLoading(false);
    setError("");
  }, [item.Id]);
  useEffect(() => {
    if (!expanded || tab !== "Extras & trailers") return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.allSettled([
      getSpecialFeatures(item.Id, controller.signal),
      getLocalTrailers(item.Id, controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setExtras(results[0].value);
      if (results[1].status === "fulfilled") setTrailers(results[1].value);
      if (results.some((result) => result.status === "rejected"))
        setError(
          "Some extras could not be loaded from Jellyfin. Reopen this tab to retry.",
        );
      setLoading(false);
    });
    return () => controller.abort();
  }, [expanded, item.Id, tab]);
  const technicalItem = playbackItem ?? item;
  const source =
    technicalItem.MediaSources?.find((version) => version.Id === sourceId) ??
    technicalItem.MediaSources?.[0];
  useEffect(() => {
    if (
      (tab === "Media info" && !source) ||
      (tab === "Chapters" && !technicalItem.Chapters?.length)
    )
      setTab("Details");
  }, [source, tab, technicalItem.Chapters?.length]);
  const tabs = [
    "Details",
    ...(source ? ["Media info"] : []),
    ...(technicalItem.Chapters?.length ? ["Chapters"] : []),
    ...(["Movie", "Series", "Episode", "Video"].includes(item.Type)
      ? ["Extras & trailers"]
      : []),
  ];
  const links =
    item.ExternalUrls?.filter(
      (link) => safeExternalUrl(link.Url) && !isContentProviderUrl(link.Url),
    ) ?? [];
  const remoteTrailers =
    item.RemoteTrailers?.filter((trailer) => safeExternalUrl(trailer.Url)) ??
    [];
  return (
    <section className="my-6">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={disclosureId}
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 border-y border-white/10 py-3 text-sm font-medium text-type-secondary hover:text-white transition-colors"
      >
        <span>{expanded ? "Hide details" : "More details"}</span>
        <Icon
          icon={Icons.CHEVRON_DOWN}
          className={`transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <Transition
        as="div"
        id={disclosureId}
        show={expanded}
        unmount={false}
        enter="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        enterFrom="opacity-0 -translate-y-1 motion-reduce:translate-y-0"
        enterTo="opacity-100 translate-y-0"
        leave="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-1 motion-reduce:translate-y-0"
        className="pt-4"
      >
        <div
          className="flex flex-wrap gap-2 border-b border-white/10 mb-5"
          role="tablist"
          aria-label="Content information"
        >
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${tab === name ? "text-white border-type-link" : "text-type-secondary border-transparent hover:text-white"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tab}>
          {technicalItem.Id !== item.Id &&
          (tab === "Media info" || tab === "Chapters") ? (
            <p className="mb-4 text-sm text-type-secondary">
              Episode: <span className="text-white">{technicalItem.Name}</span>
            </p>
          ) : null}
          {tab === "Details" ? (
            <div className="space-y-4">
              <MetadataRows
                rows={[
                  [
                    "Original title",
                    item.OriginalTitle !== item.Name
                      ? item.OriginalTitle
                      : undefined,
                  ],
                  ["Tagline", item.Taglines?.join(" · ")],
                  [
                    "Writers",
                    item.People?.filter((person) => person.Type === "Writer")
                      .map((person) => person.Name)
                      .join(", "),
                  ],
                  [
                    "Creators",
                    item.People?.filter((person) => person.Type === "Creator")
                      .map((person) => person.Name)
                      .join(", "),
                  ],
                  [
                    "Producers",
                    item.People?.filter((person) => person.Type === "Producer")
                      .map((person) => person.Name)
                      .join(", "),
                  ],
                  [
                    "Studios",
                    item.Studios?.map((studio) => studio.Name).join(", "),
                  ],
                  ["Countries", item.ProductionLocations?.join(", ")],
                  ["Original language", item.OriginalLanguage],
                  ["Tags", item.Tags?.join(", ")],
                  ["Status", item.Status],
                  ["Air days", item.AirDays?.join(", ")],
                  ["Air time", item.AirTime],
                  [
                    "Critic rating",
                    item.CriticRating === undefined
                      ? undefined
                      : `${item.CriticRating}%`,
                  ],
                  [
                    "Added",
                    item.DateCreated
                      ? new Date(item.DateCreated).toLocaleDateString()
                      : undefined,
                  ],
                  ...Object.entries(item.ProviderIds ?? {}).map(
                    ([key, value]): [string, string] => [`${key} ID`, value],
                  ),
                ]}
              />
              {links.length ? (
                <div className="flex flex-wrap gap-3">
                  {links.map((link) => (
                    <a
                      key={`${link.Name}-${link.Url}`}
                      href={link.Url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-type-link hover:underline"
                    >
                      <span className="inline-flex items-center gap-1">
                        {link.Name}
                        <Icon icon={Icons.LINK} className="text-xs" />
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {tab === "Media info" && source ? (
            <MediaSourceInfo source={source} />
          ) : null}
          {tab === "Chapters" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {technicalItem.Chapters?.map((chapter, index) => (
                <button
                  key={chapter.StartPositionTicks}
                  type="button"
                  className="text-left group"
                  onClick={() =>
                    onPlay(technicalItem, chapter.StartPositionTicks)
                  }
                >
                  <div className="aspect-video rounded-lg overflow-hidden bg-background-secondary mb-2">
                    {chapter.ImageTag ? (
                      <img
                        src={contentImageUrl(
                          technicalItem.Id,
                          "Chapter",
                          index,
                          chapter.ImageTag,
                        )}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-type-secondary">
                        {chapterTime(chapter.StartPositionTicks)}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-white">
                    {chapter.Name || `Chapter ${index + 1}`}
                  </p>
                  <p className="text-xs text-type-secondary">
                    {chapterTime(chapter.StartPositionTicks)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
          {tab === "Extras & trailers" ? (
            <div className="space-y-4">
              {loading ? <Spinner /> : null}
              {error ? (
                <p role="alert" className="text-red-400 text-sm">
                  {error}
                </p>
              ) : null}
              {[
                { title: "Trailers", items: trailers },
                { title: "Special features", items: extras },
              ]
                .filter((group) => group.items.length)
                .map((group) => (
                  <div key={group.title}>
                    <h5 className="font-semibold text-white mb-3">
                      {group.title}
                    </h5>
                    <div className="flex gap-4 overflow-x-auto pb-3">
                      {group.items.map((extra) => (
                        <button
                          type="button"
                          key={extra.Id}
                          onClick={() => onPlay(extra)}
                          className="w-48 flex-shrink-0 text-left"
                        >
                          <img
                            src={
                              getImageUrl(extra, "Primary", 400) ||
                              getImageUrl(item, "Backdrop", 400)
                            }
                            alt=""
                            className="aspect-video w-full object-cover rounded-lg bg-background-secondary"
                          />
                          <p className="mt-2 text-sm text-white">
                            {extra.Name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {remoteTrailers.length ? (
                <div className="flex flex-wrap gap-3">
                  {remoteTrailers.map((trailer, index) => (
                    <Button
                      key={trailer.Url}
                      theme="secondary"
                      href={trailer.Url}
                    >
                      <span className="inline-flex items-center gap-2">
                        {trailer.Name || `Trailer ${index + 1}`}
                        <Icon icon={Icons.LINK} className="text-sm" />
                      </span>
                    </Button>
                  ))}
                </div>
              ) : null}
              {!loading &&
              !extras.length &&
              !trailers.length &&
              !remoteTrailers.length &&
              !error ? (
                <p className="text-sm text-type-secondary">
                  No extras or trailers are available for this item.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Transition>
    </section>
  );
}
