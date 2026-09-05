import { useId } from "react";

import {
  DEFAULT_VIDEO_APPEARANCE,
  VIDEO_APPEARANCE_LIMITS,
  VideoAppearance,
} from "@/components/player/display/videoAppearance";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";

import { usePlaybackEnhancements } from "./preferences";

function PictureControl({
  field,
  label,
}: {
  field: keyof VideoAppearance;
  label: string;
}) {
  const id = useId();
  const value = usePlaybackEnhancements((state) => state.picture[field]);
  const setPicture = usePlaybackEnhancements((state) => state.setPicture);
  const resetPicture = usePlaybackEnhancements((state) => state.resetPicture);
  const [min, max] = VIDEO_APPEARANCE_LIMITS[field];
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-3">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="text-sm tabular-nums">
          {value}
          {field === "hue" ? "°" : "%"}
        </span>
        <button
          type="button"
          className="tabbable text-xs text-video-context-type-accent disabled:opacity-40"
          disabled={value === DEFAULT_VIDEO_APPEARANCE[field]}
          onClick={() => resetPicture(field)}
        >
          Reset
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => setPicture(field, Number(event.target.value))}
        className="w-full accent-video-context-light cursor-pointer"
      />
    </div>
  );
}

export function PictureSettingsView() {
  const router = useOverlayRouter("settings");
  const reset = usePlaybackEnhancements((state) => state.resetPicture);
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink onClick={() => router.navigate("/playback")}>
        Picture
      </Menu.BackLink>
      <Menu.Section className="space-y-5 pb-5">
        <PictureControl field="brightness" label="Brightness" />
        <PictureControl field="contrast" label="Contrast" />
        <PictureControl field="saturation" label="Saturation" />
        <PictureControl field="hue" label="Hue" />
        <button
          type="button"
          onClick={() => reset()}
          className="tabbable w-full py-2 px-3 rounded-lg bg-video-context-light/10 hover:bg-video-context-light/20 text-sm"
        >
          Reset picture settings
        </button>
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
