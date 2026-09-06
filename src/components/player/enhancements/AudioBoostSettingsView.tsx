import { useEffect, useId, useState } from "react";

import { Toggle } from "@/components/buttons/Toggle";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";

import { applyAudioBoost } from "./PlaybackEnhancements";
import { usePlaybackEnhancements } from "./preferences";

export function AudioBoostSettingsView() {
  const id = useId();
  const router = useOverlayRouter("settings");
  const display = usePlayerStore((state) => state.display);
  const seriesId = usePlayerStore((state) => state.meta?.jellyfinSeriesId);
  const {
    boost,
    appliedBoost,
    rememberBoost,
    audioError,
    setBoost,
    setRememberBoost,
  } = usePlaybackEnhancements();
  const [input, setInput] = useState(String(boost));
  useEffect(() => setInput(String(boost)), [boost]);
  const commitInput = () => {
    const value = Number(input);
    if (input.trim() && Number.isFinite(value)) setBoost(value);
    setInput(String(usePlaybackEnhancements.getState().boost));
  };
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/playback")}>
        Volume boost
      </Menu.BackLink>
      <Menu.Section className="space-y-4 pb-5">
        <p className="text-sm text-type-secondary">
          Amplify quiet audio. Higher values may reduce audio quality.
        </p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className="font-medium">
            Boost level
          </label>
          <div className="flex items-center gap-1">
            <input
              id={id}
              aria-label="Boost percentage"
              type="number"
              min={100}
              max={600}
              step={10}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onBlur={commitInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitInput();
              }}
              className="tabbable w-20 p-2 rounded bg-video-context-inputBg text-white"
            />
            <span>%</span>
          </div>
        </div>
        <input
          type="range"
          aria-label="Volume boost"
          min={100}
          max={600}
          step={10}
          value={boost}
          onChange={(event) => setBoost(Number(event.target.value))}
          className="w-full accent-video-context-light"
        />
        {audioError ? (
          <p role="alert" className="text-sm text-type-danger">
            {audioError}
          </p>
        ) : null}
        {audioError || (boost > 100 && appliedBoost === 100) ? (
          <button
            type="button"
            className="tabbable w-full py-2 px-3 rounded-lg bg-video-context-light/10 hover:bg-video-context-light/20"
            onClick={() => {
              if (display) applyAudioBoost(display, boost);
            }}
          >
            {boost > 100 ? "Enable volume boost" : "Resume audio"}
          </button>
        ) : null}
        <button
          type="button"
          className="tabbable w-full py-2 px-3 rounded-lg bg-video-context-light/10 hover:bg-video-context-light/20"
          onClick={() => setBoost(100)}
        >
          Reset to 100%
        </button>
        <Menu.Link
          rightSide={
            <Toggle
              enabled={rememberBoost}
              onClick={() => setRememberBoost(!rememberBoost)}
            />
          }
        >
          {seriesId ? "Remember for this series" : "Remember for this title"}
        </Menu.Link>
        <p className="text-xs text-type-secondary">
          {rememberBoost
            ? "This setting applies when you play this title again."
            : "This setting resets for the next movie or episode."}
        </p>
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
