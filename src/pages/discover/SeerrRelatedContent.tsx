import { useEffect, useRef, useState } from "react";

import { seerrToMediaItem } from "@/backend/seerr/api";
import {
  SeerrCollection,
  getSeerrCollection,
  getSeerrSimilar,
  seerrTrailers,
  sortCollectionParts,
} from "@/backend/seerr/related";
import { SeerrDetails, SeerrMedia } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { Flare } from "@/components/utils/Flare";

import { CarouselNavButtons } from "./components/CarouselNavButtons";
import { SeerrCardMenu } from "./SeerrCardMenu";

function RelatedCarousel({
  items,
  onSelect,
  id,
}: {
  items: SeerrMedia[];
  onSelect: (item: SeerrMedia) => void;
  id: string;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  return (
    <div className="relative carousel-container overflow-hidden">
      <div
        ref={(element) => {
          refs.current[id] = element;
        }}
        className="grid grid-flow-col auto-cols-max gap-4 overflow-x-auto scrollbar-none rounded-xl pb-4"
      >
        {items.map((item) => (
          <div
            key={`${item.mediaType}:${item.id}`}
            className="mt-4 w-[10rem] p-2 md:w-[11.5rem]"
          >
            <MediaCard
              media={seerrToMediaItem(item)}
              linkable
              onShowDetails={() => onSelect(item)}
              renderContextMenu={(close) => (
                <SeerrCardMenu
                  media={item}
                  close={close}
                  onShowDetails={onSelect}
                />
              )}
            />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <CarouselNavButtons categorySlug={id} carouselRefs={refs} />
      </div>
    </div>
  );
}
function CollectionOverlay({
  collection,
  open,
  onClose,
  afterLeave,
  onSelect,
}: {
  collection: NonNullable<SeerrDetails["collection"]>;
  open: boolean;
  onClose: () => void;
  afterLeave: () => void;
  onSelect: (item: SeerrMedia) => void;
}) {
  const [data, setData] = useState<SeerrCollection>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<"release" | "rating">("release");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getSeerrCollection(collection.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this collection.",
          );
      });
    return () => controller.abort();
  }, [collection.id, retry]);
  return (
    <DetailsModalFrame
      open={open}
      onClose={onClose}
      afterLeave={afterLeave}
      label={collection.name}
    >
      <div className="pointer-events-auto fixed inset-x-4 top-1/2 mx-auto w-auto max-w-7xl -translate-y-1/2 sm:inset-x-8">
        <Flare.Base className="group rounded-3xl bg-background-main p-6 shadow-lg">
          <Flare.Light
            flareSize={300}
            cssColorVar="--colors-mediaCard-hoverAccent"
            backgroundClass="bg-mediaCard-hoverBackground"
            className="rounded-3xl"
          />
          <Flare.Child className="pointer-events-auto relative max-h-[85vh] overflow-y-auto scrollbar-none">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
                  {collection.name}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
                  {data ? (
                    <span>
                      {data.parts.length}{" "}
                      {data.parts.length === 1 ? "movie" : "movies"}
                    </span>
                  ) : null}
                  <span className="text-xs text-white/60">Sort by:</span>
                  {(
                    [
                      ["release", "Release date"],
                      ["rating", "Rating"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sort === value}
                      onClick={() => setSort(value)}
                      className={`tabbable rounded-md px-3 py-1 text-xs font-medium transition-colors ${sort === value ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close collection"
                onClick={onClose}
                className="tabbable rounded-full bg-white/10 p-3 text-white"
              >
                <Icon icon={Icons.X} />
              </button>
            </div>
            {data?.overview ? (
              <p className="mb-4 max-w-4xl text-sm leading-relaxed text-white/80">
                {data.overview}
              </p>
            ) : null}
            {data ? (
              data.parts.length ? (
                <RelatedCarousel
                  id="seerr-collection"
                  items={sortCollectionParts(data.parts, sort)}
                  onSelect={onSelect}
                />
              ) : (
                <p className="py-12 text-center text-type-secondary">
                  No titles found in this collection.
                </p>
              )
            ) : error ? (
              <div className="py-12 text-center">
                <p role="alert" className="mb-4">
                  {error}
                </p>
                <Button
                  theme="secondary"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="grid grid-flow-col auto-cols-max gap-4 overflow-hidden">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="w-[10rem] p-2">
                    <MediaCardSkeleton />
                  </div>
                ))}
              </div>
            )}
          </Flare.Child>
        </Flare.Base>
      </div>
    </DetailsModalFrame>
  );
}
export function SeerrCollectionButton({
  collection,
  onSelect,
}: {
  collection: NonNullable<SeerrDetails["collection"]>;
  onSelect: (item: SeerrMedia) => void;
}) {
  const [shown, setShown] = useState(false);
  const presence = useRetainedModalValue(shown ? collection : undefined);
  return (
    <>
      <button
        type="button"
        onClick={() => setShown(true)}
        className="tabbable group flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white"
      >
        <Icon icon={Icons.FILM} className="text-white/60" />
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
            Collection
          </span>
          <span className="w-full truncate text-left text-xs font-medium">
            {collection.name}
          </span>
        </span>
        <Icon icon={Icons.CHEVRON_RIGHT} className="shrink-0 text-white/40" />
      </button>
      {presence.value ? (
        <CollectionOverlay
          key={presence.value.id}
          collection={presence.value}
          open={presence.open}
          onClose={() => setShown(false)}
          afterLeave={presence.afterLeave}
          onSelect={(item) => {
            setShown(false);
            onSelect(item);
          }}
        />
      ) : null}
    </>
  );
}
export function SeerrRelatedContent({
  details,
  onSelect,
}: {
  details: SeerrDetails;
  onSelect: (item: SeerrMedia) => void;
}) {
  const videos = seerrTrailers(details);
  const [trailer, setTrailer] = useState<(typeof videos)[number]>();
  const [similar, setSimilar] = useState<SeerrMedia[]>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(false);
  const similarRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!similarRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(similarRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setError("");
    getSeerrSimilar(details.id, details.mediaType, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSimilar(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load similar titles.",
          );
      });
    return () => controller.abort();
  }, [details.id, details.mediaType, retry, visible]);
  return (
    <>
      {videos.length ? (
        <section className="space-y-4 pt-8">
          <h4 className="text-lg font-semibold text-white/90">
            Trailers and extras
          </h4>
          <div className="relative carousel-container">
            <div
              ref={(element) => {
                refs.current.trailers = element;
              }}
              className="flex gap-4 overflow-x-auto scrollbar-none pb-4"
            >
              {videos.map((video) => (
                <button
                  key={video.key}
                  type="button"
                  onClick={() => setTrailer(video)}
                  className="tabbable shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80"
                >
                  <div className="relative h-44 w-72 overflow-hidden bg-black/60 sm:h-52 sm:w-96">
                    <img
                      src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
                    <span className="absolute left-3 right-3 top-3 text-left text-sm font-medium leading-tight text-white line-clamp-2">
                      {video.name}
                    </span>
                    <Icon
                      icon={Icons.PLAY}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-white"
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden md:block">
              <CarouselNavButtons categorySlug="trailers" carouselRefs={refs} />
            </div>
          </div>
        </section>
      ) : null}
      <div ref={similarRef} className="pt-8">
        {similar?.length ? (
          <section>
            <h4 className="text-lg font-semibold text-white/90">
              More like this
            </h4>
            <RelatedCarousel
              id="seerr-similar"
              items={similar}
              onSelect={onSelect}
            />
          </section>
        ) : visible && !similar && !error ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-type-secondary">
              {error}
            </p>
            <Button
              theme="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry similar titles
            </Button>
          </div>
        ) : null}
      </div>
      <DetailsModalFrame
        open={Boolean(trailer)}
        onClose={() => setTrailer(undefined)}
        afterLeave={() => undefined}
        label={trailer?.name || "Trailer"}
      >
        <div className="pointer-events-auto fixed left-1/2 top-1/2 w-[90%] max-w-6xl -translate-x-1/2 -translate-y-1/2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-white font-semibold">{trailer?.name}</h3>
            <button
              type="button"
              onClick={() => setTrailer(undefined)}
              aria-label="Close trailer"
              className="tabbable rounded-full bg-white/10 p-3 text-white"
            >
              <Icon icon={Icons.X} />
            </button>
          </div>
          {trailer ? (
            <iframe
              title={trailer.name}
              referrerPolicy="strict-origin-when-cross-origin"
              src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
              className="aspect-video w-full rounded-lg bg-black"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </div>
      </DetailsModalFrame>
    </>
  );
}
