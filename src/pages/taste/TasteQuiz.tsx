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
  FRANCHISES,
  GENRES,
  MOODS,
  TasteCandidate,
  TasteRating,
  TasteType,
} from "@/backend/personalisation/types";
import { Button } from "@/components/buttons/Button";
import { DetailsModalFrame } from "@/components/overlays/DetailsModalFrame";
import { getTasteProfile, useTasteStore } from "@/stores/taste";

export function TasteQuiz({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<
    "movies" | "shows" | "genres" | "moods" | "franchises" | "done"
  >("movies");
  const [type, setType] = useState<TasteType>("movie");
  const [preferences, setPreferences] = useState(() => ({
    ...getTasteProfile().preferences,
  }));
  const [rated, setRated] = useState({ movie: 0, tv: 0 });
  const [reminder, setReminder] = useState(false);
  const [queue, setQueue] = useState<TasteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const seen = useRef(new Set<string>());
  const pools = useRef<TasteCandidate[]>([]);
  const pages = useRef({ movie: 0, tv: 0 });
  const hasMore = useRef({ movie: true, tv: true });
  const generation = useRef(0);
  useEffect(() => {
    if (!["movies", "shows"].includes(step) || queue.length >= 5) return;
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
  }, [step, type, queue.length, retry]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const finish = () => {
    useTasteStore
      .getState()
      .setPreferences({ ...preferences, completedQuiz: true });
    setStep("done");
  };
  const nextStage = () => {
    generation.current += 1;
    setReminder(false);
    if (step === "movies") {
      setType("tv");
      setQueue([]);
      setStep("shows");
    } else setStep("genres");
    setError("");
  };
  const answer = async (rating?: TasteRating) => {
    if (saving || !queue[0]) return;
    const currentGeneration = generation.current;
    setSaving(true);
    setError("");
    try {
      if (rating) {
        const media = await enrichTasteMedia(queue[0].media);
        if (currentGeneration !== generation.current) return;
        useTasteStore.getState().rate(media, rating, false);
        const count = rated[type] + 1;
        setRated((counts) => ({ ...counts, [type]: count }));
        if (count % 25 === 0) setReminder(true);
      }
      if (currentGeneration === generation.current)
        setQueue((items) => items.slice(1));
    } catch (reason) {
      if (currentGeneration === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to save this rating.",
        );
    } finally {
      if (currentGeneration === generation.current) setSaving(false);
    }
  };
  const current = queue[0]?.media;
  const groups = {
    genres: {
      title: "Which genres do you enjoy?",
      description: "Pick as many as you like.",
      key: "favoriteGenres" as const,
      choices: GENRES.map((genre) => ({ id: genre, label: genre })),
      back: "shows" as const,
      next: "moods" as const,
    },
    moods: {
      title: "What are you usually in the mood for?",
      description: "Pick as many as you like.",
      key: "moods" as const,
      choices: MOODS,
      back: "genres" as const,
      next: "franchises" as const,
    },
    franchises: {
      title: "Any favourite franchises?",
      description:
        "Their movies and shows will get a head start in your suggestions.",
      key: "franchises" as const,
      choices: FRANCHISES,
      back: "moods" as const,
      next: "done" as const,
    },
  };
  const group =
    step === "genres" || step === "moods" || step === "franchises"
      ? groups[step]
      : undefined;
  return (
    <section className="rounded-xl bg-white/5 p-6" aria-label="Taste setup">
      {step === "movies" || step === "shows" ? (
        <div className="relative">
          <h2 className="mb-1 text-lg font-semibold text-white">
            {type === "movie"
              ? "Have you seen these movies?"
              : "What about these shows?"}
          </h2>
          <p className="mb-4 text-sm text-type-secondary">
            {type === "movie"
              ? "Rate the ones you have watched, skip the rest. There is no fixed list, so keep going as long as you like."
              : "Same idea, but for TV. We keep movies and shows separate."}
          </p>
          {current ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {tastePoster(current) ? (
                <img
                  className="w-36 shrink-0 rounded-lg"
                  src={tastePoster(current)}
                  alt=""
                />
              ) : (
                <div className="h-52 w-36 shrink-0 rounded-lg bg-white/10" />
              )}
              <div className="w-full flex-1">
                <p className="mb-1 text-xs text-type-secondary">
                  Rated {rated[type]}
                </p>
                <h3 className="mb-3 text-xl font-semibold text-white">
                  {current.title}
                  {current.year ? ` (${current.year})` : ""}
                </h3>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["loved", "Loved it!"],
                      ["liked", "Liked it"],
                      ["okay", "Meh, it was okay"],
                      ["disliked", "Didn't like it"],
                      [undefined, "I haven't watched it"],
                    ] as [TasteRating | undefined, string][]
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={saving}
                      onClick={() => answer(value)}
                      className="tabbable rounded-lg bg-white/5 px-4 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/15 disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : loading ? (
            <p role="status" className="text-sm text-type-secondary">
              Finding titles…
            </p>
          ) : (
            <p className="text-sm text-type-secondary">
              That is everything we could load for now. You can continue to the
              next step.
            </p>
          )}
          {error ? (
            <p role="alert" className="mt-4 text-sm text-type-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-3">
            {(!current || error) && !loading ? (
              <Button
                theme="secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Load more titles
              </Button>
            ) : null}
            <Button theme="secondary" disabled={saving} onClick={nextStage}>
              Stop for now
            </Button>
          </div>
          <DetailsModalFrame
            open={reminder}
            onClose={() => setReminder(false)}
            afterLeave={() => undefined}
            label="Continue rating"
          >
            <div className="pointer-events-auto fixed inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 rounded-xl bg-background-main p-6 text-center">
              <div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  You have rated {rated[type]}
                </h3>
                <p className="mb-6 text-sm text-type-secondary">
                  That is plenty to work with. Feel free to stop here, or keep
                  going if you are having fun.
                </p>
                <div className="flex justify-center gap-3">
                  <Button theme="secondary" onClick={() => setReminder(false)}>
                    Keep going
                  </Button>
                  <Button theme="purple" onClick={nextStage}>
                    Finish for now
                  </Button>
                </div>
              </div>
            </div>
          </DetailsModalFrame>
        </div>
      ) : group ? (
        <div>
          <h2 className="mb-1 text-lg font-semibold text-white">
            {group.title}
          </h2>
          <p className="mb-4 text-sm text-type-secondary">
            {group.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.choices.map((choice) => {
              const active = preferences[group.key].includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={active}
                  className={`tabbable rounded-full px-4 py-2 text-sm transition-colors ${active ? "bg-video-context-type-accent/30 text-white ring-1 ring-white/40" : "bg-white/5 text-white/80 hover:bg-white/10"}`}
                  onClick={() =>
                    setPreferences((value) => ({
                      ...value,
                      [group.key]: active
                        ? value[group.key].filter((id) => id !== choice.id)
                        : [...value[group.key], choice.id],
                    }))
                  }
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <Button theme="secondary" onClick={() => setStep(group.back)}>
              Back
            </Button>
            <Button
              theme="purple"
              onClick={() =>
                group.next === "done" ? finish() : setStep(group.next)
              }
            >
              {group.next === "done" ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">
            Your taste profile is ready!
          </h2>
          <p className="mb-6 text-sm text-type-secondary">
            Your Discover recommendations now reflect your taste. Keep rating
            what you watch to improve your suggestions.
          </p>
          <Button theme="purple" onClick={onFinish}>
            See my taste profile
          </Button>
        </div>
      )}
    </section>
  );
}
