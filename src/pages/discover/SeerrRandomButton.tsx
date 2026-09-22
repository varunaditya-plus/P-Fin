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
  const [pick, setPick] = useState<SeerrMedia>();
  const [countdown, setCountdown] = useState<number>();
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController>();
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    setPick(undefined);
    setCountdown(undefined);
    setLoading(false);
    return () => controller.current?.abort();
  }, [type, endpoint, disabled]);
  useEffect(() => {
    if (countdown === undefined || !pick) return;
    if (countdown === 0) {
      select.current(pick);
      setCountdown(undefined);
      setPick(undefined);
      return;
    }
    const timer = setTimeout(
      () =>
        setCountdown((value) => (value === undefined ? undefined : value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown, pick]);
  const choose = async () => {
    if (countdown !== undefined) {
      setCountdown(undefined);
      setPick(undefined);
      return;
    }
    if (loading || disabled) return;
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
      else {
        setPick(media);
        setCountdown(5);
      }
    } catch (reason) {
      if (!request.signal.aborted)
        onError(
          reason instanceof Error
            ? reason.message
            : "Unable to choose a title.",
        );
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };
  return (
    <button
      type="button"
      disabled={loading || disabled}
      aria-label={
        countdown === undefined
          ? `Random ${type === "movie" ? "movie" : "TV show"}`
          : `Cancel opening ${pick?.title || pick?.name}`
      }
      title={countdown === undefined ? "Surprise me" : "Click to cancel"}
      onClick={choose}
      className={`tabbable relative flex h-12 max-w-full shrink-0 items-center overflow-hidden rounded-full bg-pill-background bg-opacity-50 text-white backdrop-blur-lg transition-all duration-300 hover:scale-105 hover:bg-pill-backgroundHover active:scale-95 motion-reduce:transition-none disabled:opacity-60 ${countdown === undefined ? "w-12" : "pl-3"}`}
    >
      {countdown !== undefined ? (
        <span className="max-w-56 truncate font-bold" aria-live="polite">
          {pick?.title || pick?.name}
        </span>
      ) : null}
      <span className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center">
        {countdown !== undefined ? (
          <span className="text-lg font-bold motion-safe:animate-pulse">
            {countdown}
          </span>
        ) : loading ? (
          <Spinner />
        ) : (
          <img src="/lightbar-images/dice.svg" alt="" className="h-6 w-6" />
        )}
      </span>
    </button>
  );
}
