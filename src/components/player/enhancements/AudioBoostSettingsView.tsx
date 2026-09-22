import { useEffect, useRef, useState } from "react";

import { Toggle } from "@/components/buttons/Toggle";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";

import { applyAudioBoost } from "./PlaybackEnhancements";
import { PlaybackSlider } from "./PlaybackSlider";
import { usePlaybackEnhancements } from "./preferences";

export function AudioBoostControls() {
  const display = usePlayerStore((state) => state.display);
  const {
    boost,
    appliedBoost,
    rememberBoost,
    activeTitle,
    audioError,
    setBoost,
    setRememberBoost,
  } = usePlaybackEnhancements();
  const [enabled, setEnabled] = useState(boost > 100);
  const previousTitle = useRef(activeTitle);
  useEffect(() => {
    if (previousTitle.current === activeTitle) return;
    previousTitle.current = activeTitle;
    setEnabled(boost > 100);
  }, [activeTitle, boost]);
  return (
    <>
      <Menu.Link
        rightSide={
          <Toggle
            label="Volume boost"
            enabled={enabled}
            onClick={() => {
              setEnabled(!enabled);
              if (enabled) setBoost(100);
            }}
          />
        }
      >
        Volume boost
      </Menu.Link>
      {enabled ? (
        <>
          <PlaybackSlider
            label="Boost level"
            value={boost}
            min={100}
            max={1000}
            step={5}
            defaultValue={100}
            onChange={setBoost}
            onReset={() => setBoost(100)}
            allowDirectInput
          />
          {audioError ? (
            <p role="alert" className="text-sm text-type-danger">
              {audioError}
            </p>
          ) : null}
          {audioError || (boost > 100 && appliedBoost === 100) ? (
            <button
              type="button"
              className="tabbable w-full py-2 px-3 rounded-lg bg-video-context-light/10 hover:bg-video-context-light/20 text-sm"
              onClick={() => {
                if (display) applyAudioBoost(display, boost);
              }}
            >
              {boost > 100 ? "Enable volume boost" : "Resume audio"}
            </button>
          ) : null}
          <Menu.Link
            rightSide={
              <Toggle
                label="Remember volume boost for this title"
                disabled={!activeTitle}
                enabled={rememberBoost}
                onClick={() => {
                  if (activeTitle) setRememberBoost(!rememberBoost);
                }}
              />
            }
          >
            Remember for this title
          </Menu.Link>
        </>
      ) : null}
    </>
  );
}

export function AudioBoostSettingsView() {
  const router = useOverlayRouter("settings");
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/playback")}>
        Volume boost
      </Menu.BackLink>
      <Menu.Section className="space-y-4 pb-5">
        <AudioBoostControls />
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
