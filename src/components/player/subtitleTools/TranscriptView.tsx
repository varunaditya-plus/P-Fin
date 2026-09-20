import { useEffect, useMemo, useRef, useState } from "react";

import { Icon, Icons } from "@/components/Icon";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";
import { durationExceedsHour, formatSeconds } from "@/utils/formatSeconds";

import { restoreSubtitleTranslation, useSubtitleToolState } from "./state";
import { transcriptCues, transcriptMatches } from "./transcript";

export function TranscriptView() {
  const router = useOverlayRouter("settings");
  const caption = usePlayerStore((state) => state.caption.selected);
  const { time, duration } = usePlayerStore((state) => state.progress);
  const delay = useSubtitleStore((state) => state.delay);
  const original = useSubtitleToolState((state) => state.translation?.original);
  const [query, setQuery] = useState("");
  const [edges, setEdges] = useState({ top: true, bottom: false });
  const viewport = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const parsed = useMemo(() => {
    try {
      return {
        cues: caption ? transcriptCues(caption.srtData) : [],
        error: "",
      };
    } catch {
      return {
        cues: [],
        error:
          "This track cannot be shown as a transcript. Choose a text subtitle track.",
      };
    }
  }, [caption]);
  const filtered = useMemo(
    () => parsed.cues.filter((cue) => transcriptMatches(cue.text, query)),
    [parsed, query],
  );
  const active = filtered.find(
    (cue) => time >= cue.start / 1000 + delay && time < cue.end / 1000 + delay,
  );
  const following =
    active ?? filtered.find((cue) => cue.start / 1000 + delay > time);
  useEffect(() => setQuery(""), [caption]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const parent = viewport.current;
      const line = target.current;
      if (!parent || !line) return;
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const next =
        parent.scrollTop +
        line.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        line.offsetHeight / 2 -
        parent.clientHeight * 0.6;
      parent.scrollTo?.({
        top: Math.max(
          0,
          Math.min(next, parent.scrollHeight - parent.clientHeight),
        ),
        behavior: reduced ? "auto" : "smooth",
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [following?.index, query]);
  const updateEdges = () => {
    const element = viewport.current;
    if (element)
      setEdges({
        top: element.scrollTop <= 0,
        bottom:
          element.scrollHeight - element.scrollTop - element.clientHeight < 2,
      });
  };
  useEffect(updateEdges, [filtered.length]);
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/captions")}>
        Transcript
      </Menu.BackLink>
      <div className="min-h-0 flex flex-col">
        <Menu.Section>
          <div className="w-full relative">
            <Icon
              icon={Icons.SEARCH}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-video-context-inputPlaceholder"
            />
            <input
              aria-label="Search transcript"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full py-2 px-3 pl-[calc(0.75rem+24px)] tabbable bg-video-context-inputBg rounded placeholder:text-video-context-inputPlaceholder"
            />
          </div>
          {original ? (
            <button
              type="button"
              onClick={restoreSubtitleTranslation}
              className="tabbable text-xs text-video-context-type-accent pt-3"
            >
              Restore original
            </button>
          ) : null}
        </Menu.Section>
        <div
          ref={viewport}
          onScroll={updateEdges}
          className={`max-h-[18rem] min-h-0 overflow-y-auto vertical-carousel-container ${edges.top ? "hide-top-gradient" : ""} ${edges.bottom ? "hide-bottom-gradient" : ""}`}
        >
          <div className="flex flex-col gap-1 pb-4">
            {parsed.error ? (
              <p role="alert" className="text-type-danger py-3 text-sm">
                {parsed.error}
              </p>
            ) : null}
            {!caption ? (
              <p className="py-3 text-sm text-type-secondary">
                Select a text subtitle track to see its transcript.
              </p>
            ) : null}
            {caption && !filtered.length && !parsed.error ? (
              <p className="py-3 text-sm text-type-secondary">
                No matching lines.
              </p>
            ) : null}
            {filtered.map((cue) => {
              const current = active === cue;
              const seconds = Math.max(0, cue.start / 1000 + delay);
              return (
                <button
                  key={`${cue.index}-${cue.start}`}
                  ref={following === cue ? target : undefined}
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() =>
                    usePlayerStore.getState().display?.setTime(seconds)
                  }
                  className={`tabbable flex w-full items-start py-2 px-2 rounded-lg text-left transition-colors duration-100 hover:bg-video-context-light/20 ${current ? "bg-video-context-light/20" : ""}`}
                >
                  <span className="mr-3 flex-none w-[4.5rem] h-[1.75rem] flex items-center justify-center px-0 leading-tight rounded-md bg-video-context-light/20 text-video-context-type-main font-normal whitespace-nowrap overflow-hidden text-sm">
                    {formatSeconds(seconds, durationExceedsHour(duration))}
                  </span>
                  <span
                    className={`flex-1 text-sm whitespace-pre-line ${current ? "text-white font-semibold" : "text-video-context-type-main"}`}
                  >
                    {cue.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Menu.CardWithScrollable>
  );
}
