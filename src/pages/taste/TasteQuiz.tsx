import { useEffect, useRef, useState } from "react";

import {
  enrichTasteMedia,
  getSeerrTastePage,
  getTasteLibrary,
  seerrTasteEnabled,
  tastePoster,
} from "@/backend/personalisation/catalog";
import { nextQuizBatch } from "@/backend/personalisation/engine";
import {
  TasteCandidate,
  TasteRating,
  TasteType,
} from "@/backend/personalisation/types";
import { Button } from "@/components/buttons/Button";
import { getTasteProfile, useTasteStore } from "@/stores/taste";

export function TasteQuiz({ onFinish }: { onFinish: () => void }) {
  const [type, setType] = useState<TasteType>("movie");
  const [queue, setQueue] = useState<TasteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(0);
  const [retry, setRetry] = useState(0);
  const seen = useRef(new Set<string>());
  const pools = useRef<TasteCandidate[]>([]);
  const pages = useRef({ movie: 0, tv: 0 });
  const hasMore = useRef({ movie: true, tv: true });
  const generation = useRef(0);
  useEffect(() => {
    if (queue.length >= 3) return;
    const current = generation.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const fill = async () => {
      if (!pools.current.length)
        pools.current = await getTasteLibrary(controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (seerrTasteEnabled() && hasMore.current[type]) {
        try {
          const page = await getSeerrTastePage(
            type,
            pages.current[type] + 1,
            controller.signal,
          );
          if (controller.signal.aborted || current !== generation.current)
            return;
          pages.current[type] += 1;
          hasMore.current[type] = pages.current[type] < page.totalPages;
          pools.current = [
            ...new Map(
              [...page.items, ...pools.current].map((item) => [
                item.media.key,
                item,
              ]),
            ).values(),
          ];
        } catch (reason) {
          if (controller.signal.aborted) throw reason;
          setError(
            "Seerr titles could not load. You can still rate titles from your library, or retry below.",
          );
        }
      }
      const next = nextQuizBatch(
        pools.current,
        getTasteProfile(),
        type,
        seen.current,
      );
      next.forEach((item) => seen.current.add(item.media.key));
      setQueue((previous) => [...previous, ...next]);
    };
    fill()
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load quiz titles.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, queue.length, retry]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const finish = () => {
    useTasteStore.getState().setPreferences({ completedQuiz: true });
    onFinish();
  };
  const nextStage = () => {
    if (type === "tv") {
      finish();
      return;
    }
    generation.current += 1;
    setType("tv");
    setQueue([]);
    setError("");
  };
  const answer = async (rating?: TasteRating) => {
    if (saving || !queue[0]) return;
    const current = generation.current;
    setSaving(true);
    setError("");
    try {
      if (rating) {
        const media = await enrichTasteMedia(queue[0].media);
        if (current !== generation.current) return;
        useTasteStore.getState().rate(media, rating, false);
      }
      if (current === generation.current) {
        setQueue((items) => items.slice(1));
        setAnswered((value) => value + 1);
      }
    } catch (reason) {
      if (current === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to save this rating.",
        );
    } finally {
      if (current === generation.current) setSaving(false);
    }
  };
  const current = queue[0]?.media;
  return (
    <section className="rounded-xl border border-white/10 bg-dropdown-background p-5 sm:p-8 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl font-bold text-white">
          Taste setup · {type === "movie" ? "Movies" : "TV shows"}
        </h2>
        <span className="text-sm text-type-secondary">{answered} answered</span>
      </div>
      <p className="text-type-secondary">
        Rate titles you have seen. Skip anything unfamiliar. You can finish at
        any time.
      </p>
      {current ? (
        <div className="flex flex-col sm:flex-row gap-6">
          <img
            className="w-32 sm:w-40 rounded-xl aspect-[2/3] object-cover bg-background-main self-center"
            src={tastePoster(current)}
            alt=""
          />
          <div className="flex-1 space-y-4">
            <h3 className="text-2xl font-bold text-white">{current.title}</h3>
            <p className="text-sm text-type-secondary">
              {current.year} · {current.genres.join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["loved", "Loved"],
                  ["liked", "Liked"],
                  ["okay", "Okay"],
                  ["disliked", "Disliked"],
                ] as [TasteRating, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  theme="secondary"
                  disabled={saving}
                  onClick={() => answer(value)}
                >
                  {label}
                </Button>
              ))}
              <Button
                theme="secondary"
                disabled={saving}
                onClick={() => answer()}
              >
                Not watched
              </Button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <p role="status">Finding titles…</p>
      ) : (
        <p>No more unseen titles in this batch.</p>
      )}
      {error ? (
        <p role="alert" className="text-type-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3 flex-wrap">
        <Button theme="purple" disabled={saving} onClick={nextStage}>
          {type === "movie" ? "Continue to TV shows" : "Finish setup"}
        </Button>
        <Button theme="secondary" disabled={saving} onClick={finish}>
          Finish now
        </Button>
        {(!current || error) && !loading ? (
          <Button
            theme="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Load more titles
          </Button>
        ) : null}
      </div>
    </section>
  );
}
