import { useEffect, useRef, useState } from "react";

import { randomSeerrMedia } from "@/backend/seerr/browse";
import { SeerrMedia, SeerrMediaType } from "@/backend/seerr/types";
import { Spinner } from "@/components/layout/Spinner";

export function SeerrRandomButton({
  type,
  endpoint,
  disabled,
  onSelect,
  onError,
}: {
  type: SeerrMediaType;
  endpoint?: string;
  disabled?: boolean;
  onSelect: (media: SeerrMedia) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController>();
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    setLoading(false);
    return () => {
      controller.current?.abort();
      controller.current = undefined;
    };
  }, [type, endpoint, disabled]);
  const choose = async () => {
    if (controller.current || disabled) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    onError("");
    try {
      const media = await randomSeerrMedia(
        type,
        request.signal,
        Math.random,
        endpoint,
      );
      if (request.signal.aborted) return;
      if (!media) onError("Seerr has no titles to choose from.");
      else select.current(media);
    } catch (reason) {
      if (!request.signal.aborted)
        onError(
          reason instanceof Error
            ? reason.message
            : "Unable to choose a title.",
        );
    } finally {
      if (controller.current === request) {
        controller.current = undefined;
        if (!request.signal.aborted) setLoading(false);
      }
    }
  };
  return (
    <button
      type="button"
      disabled={loading || disabled}
      aria-label={`Random ${type === "movie" ? "movie" : "TV show"}`}
      title="Surprise me"
      onClick={choose}
      className="tabbable relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pill-background bg-opacity-50 text-white backdrop-blur-lg transition-all duration-300 hover:scale-105 hover:bg-pill-backgroundHover active:scale-95 motion-reduce:transition-none disabled:opacity-60"
    >
      {loading ? (
        <Spinner />
      ) : (
        <img src="/lightbar-images/dice.svg" alt="" className="h-6 w-6" />
      )}
    </button>
  );
}
