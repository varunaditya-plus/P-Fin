import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Menu } from "@/components/player/internals/ContextMenu";
import { timedTextToSrt } from "@/components/player/utils/ttml";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";
import { formatSeconds } from "@/utils/formatSeconds";

import { useSubtitleTools, validateSubtitleTools } from "./preferences";
import {
  transcriptCues,
  transcriptMatches,
  translateTranscript,
} from "./transcript";

export function TranscriptView() {
  const router = useOverlayRouter("settings");
  const caption = usePlayerStore((s) => s.caption.selected);
  const time = usePlayerStore((s) => s.progress.time);
  const delay = useSubtitleStore((s) => s.delay);
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(150);
  const [follow, setFollow] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
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
  const activeIndex = parsed.cues.findIndex(
    (cue) => time >= cue.start / 1000 + delay && time < cue.end / 1000 + delay,
  );
  const start = follow && !query ? Math.max(0, activeIndex - 40) : 0;
  const visible = filtered.slice(start, start + count);
  useEffect(() => {
    if (follow) activeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, follow]);
  const preferences = useSubtitleTools();
  const [endpoint, setEndpoint] = useState(preferences.translationEndpoint);
  const [target, setTarget] = useState(preferences.targetLanguage);
  const [apiKey, setApiKey] = useState("");
  const [translationOpen, setTranslationOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [original, setOriginal] = useState<typeof caption>(null);
  const controller = useRef<AbortController>();
  useEffect(() => {
    setOriginal(null);
    setQuery("");
    setError("");
    return () => controller.current?.abort();
  }, [caption?.id]);
  const translate = async () => {
    if (!caption || !parsed.cues.length || progress !== null) return;
    const request = new AbortController();
    controller.current = request;
    setError("");
    setProgress(0);
    try {
      useSubtitleTools.setState(
        validateSubtitleTools({
          ...preferences,
          translationEndpoint: endpoint,
          targetLanguage: target,
        }),
      );
      const cues = await translateTranscript(
        parsed.cues,
        endpoint,
        target,
        apiKey,
        request.signal,
        setProgress,
      );
      if (
        request.signal.aborted ||
        usePlayerStore.getState().caption.selected?.id !== caption.id
      )
        return;
      setOriginal((value) => value ?? caption);
      usePlayerStore.getState().setCaption({
        ...caption,
        id: caption.id,
        language: target,
        srtData: timedTextToSrt(cues),
      });
      setTranslationOpen(false);
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Translation failed.",
        );
    } finally {
      setProgress(null);
    }
  };
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/captions")}>
        Transcript
      </Menu.BackLink>
      <Menu.Section className="space-y-3">
        <input
          aria-label="Search transcript"
          placeholder="Search transcript"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCount(150);
          }}
          className="w-full rounded-lg bg-video-context-inputBg p-3 text-white tabbable"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="tabbable rounded-lg bg-video-context-light/10 px-3 py-2"
            onClick={() => setFollow(!follow)}
          >
            {follow ? "Stop following" : "Follow current line"}
          </button>
          <button
            type="button"
            className="tabbable rounded-lg bg-video-context-light/10 px-3 py-2"
            onClick={() => setTranslationOpen(!translationOpen)}
          >
            Translate…
          </button>
          {original ? (
            <button
              type="button"
              className="tabbable rounded-lg px-3 py-2"
              onClick={() => {
                usePlayerStore.getState().setCaption(original);
                setOriginal(null);
              }}
            >
              Restore original
            </button>
          ) : null}
        </div>
        {translationOpen ? (
          <div className="space-y-3 rounded-xl bg-video-context-light/5 p-3">
            <p className="text-sm text-type-secondary">
              Send this track&apos;s text to your configured
              LibreTranslate-compatible service. Translation replaces the local
              text track until you restore it or switch tracks.
            </p>
            <label className="block text-sm">
              Translate endpoint
              <input
                aria-label="Translate endpoint"
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://translate.example/translate"
                className="mt-1 w-full rounded-lg bg-video-context-inputBg p-2 text-white"
              />
            </label>
            <label className="block text-sm">
              Target language
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full rounded-lg bg-video-context-inputBg p-2 text-white"
              />
            </label>
            <label className="block text-sm">
              API key (optional, kept for this panel only)
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 w-full rounded-lg bg-video-context-inputBg p-2 text-white"
              />
            </label>
            <Button
              disabled={progress !== null || !caption}
              onClick={translate}
            >
              {progress === null
                ? "Translate track"
                : `Translating ${progress}%`}
            </Button>
            {progress !== null ? (
              <button type="button" onClick={() => controller.current?.abort()}>
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
        {error || parsed.error ? (
          <p role="alert" className="text-type-danger">
            {error || parsed.error}
          </p>
        ) : null}
        {!caption ? (
          <p className="text-type-secondary">
            Select a text subtitle track to see its transcript.
          </p>
        ) : null}
        {caption && !filtered.length && !parsed.error ? (
          <p className="text-type-secondary">No matching lines.</p>
        ) : null}
        {visible.map((cue) => {
          const active =
            time >= cue.start / 1000 + delay && time < cue.end / 1000 + delay;
          return (
            <button
              ref={active ? activeRef : undefined}
              type="button"
              key={`${cue.index}-${cue.start}`}
              aria-current={active ? "true" : undefined}
              onClick={() =>
                usePlayerStore
                  .getState()
                  .display?.setTime(Math.max(0, cue.start / 1000 + delay))
              }
              className={`tabbable block w-full rounded-lg px-3 py-2 text-left ${active ? "bg-video-context-light/20 text-white" : "text-type-secondary hover:bg-video-context-light/10"}`}
            >
              <span className="mr-2 text-xs tabular-nums">
                {formatSeconds(Math.max(0, cue.start / 1000 + delay), true)}
              </span>
              {cue.text}
            </button>
          );
        })}
        {start + count < filtered.length ? (
          <button
            type="button"
            className="tabbable w-full py-3"
            onClick={() => {
              setFollow(false);
              setCount(count + 150);
            }}
          >
            Show more lines
          </button>
        ) : null}
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
