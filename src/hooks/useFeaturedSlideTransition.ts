import { useCallback, useEffect, useRef, useState } from "react";

const FADE_OUT_MS = 150;
const FADE_IN_DELAY_MS = 100;
const SLIDE_DURATION_MS = 8000;

function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function useFeaturedSlideTransition(
  itemCount: number,
  paused = false,
  autoPlay = true,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [contentOpacity, setContentOpacity] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [autoPlayRevision, setAutoPlayRevision] = useState(0);
  const currentIndexRef = useRef(0);
  const targetIndexRef = useRef(0);
  const fadeTimerRef = useRef<number>();
  const revealTimerRef = useRef<number>();

  const clearTransition = useCallback(() => {
    window.clearTimeout(fadeTimerRef.current);
    window.clearTimeout(revealTimerRef.current);
    fadeTimerRef.current = undefined;
    revealTimerRef.current = undefined;
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (itemCount < 2) return;
      const nextIndex = ((index % itemCount) + itemCount) % itemCount;
      if (
        nextIndex === currentIndexRef.current &&
        fadeTimerRef.current === undefined &&
        revealTimerRef.current === undefined
      )
        return;

      targetIndexRef.current = nextIndex;
      clearTransition();
      setAutoPlayRevision((value) => value + 1);
      if (reducedMotion) {
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setContentOpacity(1);
        return;
      }

      setContentOpacity(0);
      fadeTimerRef.current = window.setTimeout(() => {
        fadeTimerRef.current = undefined;
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        revealTimerRef.current = window.setTimeout(() => {
          revealTimerRef.current = undefined;
          setContentOpacity(1);
        }, FADE_IN_DELAY_MS);
      }, FADE_OUT_MS);
    },
    [clearTransition, itemCount, reducedMotion],
  );

  const move = useCallback(
    (direction: number) => goTo(targetIndexRef.current + direction),
    [goTo],
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    clearTransition();
    currentIndexRef.current = 0;
    targetIndexRef.current = 0;
    setCurrentIndex(0);
    setContentOpacity(1);
  }, [clearTransition, itemCount]);

  useEffect(() => {
    if (!reducedMotion) return;
    clearTransition();
    currentIndexRef.current = targetIndexRef.current;
    setCurrentIndex(targetIndexRef.current);
    setContentOpacity(1);
  }, [clearTransition, reducedMotion]);

  useEffect(() => {
    if (paused || !autoPlay || reducedMotion || itemCount < 2) return undefined;
    const timer = window.setTimeout(() => move(1), SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [autoPlay, autoPlayRevision, itemCount, move, paused, reducedMotion]);

  useEffect(() => clearTransition, [clearTransition]);

  return { currentIndex, contentOpacity, reducedMotion, goTo, move };
}
