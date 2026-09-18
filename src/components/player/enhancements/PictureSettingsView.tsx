import { Icon, Icons } from "@/components/Icon";
import {
  DEFAULT_VIDEO_APPEARANCE,
  VIDEO_APPEARANCE_LIMITS,
  VideoAppearance,
} from "@/components/player/display/videoAppearance";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";

import { PlaybackSlider } from "./PlaybackSlider";
import { usePlaybackEnhancements } from "./preferences";

export function PictureControl({
  field,
  label,
}: {
  field: keyof VideoAppearance;
  label: string;
}) {
  const value = usePlaybackEnhancements((state) => state.picture[field]);
  const setPicture = usePlaybackEnhancements((state) => state.setPicture);
  const resetPicture = usePlaybackEnhancements((state) => state.resetPicture);
  const [min, max] = VIDEO_APPEARANCE_LIMITS[field];
  return (
    <PlaybackSlider
      label={label}
      value={value}
      min={min}
      max={max}
      defaultValue={DEFAULT_VIDEO_APPEARANCE[field]}
      unit={field === "hue" ? "°" : "%"}
      onChange={(next) => setPicture(field, next)}
      onReset={() => resetPicture(field)}
    />
  );
}

export function PictureSettingsView() {
  const router = useOverlayRouter("settings");
  const reset = usePlaybackEnhancements((state) => state.resetPicture);
  const picture = usePlaybackEnhancements((state) => state.picture);
  const changed = Object.entries(DEFAULT_VIDEO_APPEARANCE).some(
    ([key, value]) => picture[key as keyof VideoAppearance] !== value,
  );
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink
        onClick={() => router.navigate("/playback")}
        rightSide={
          changed ? (
            <button
              type="button"
              className="-mr-2 -my-1 px-2 p-[0.4em] rounded tabbable hover:bg-video-context-light hover:bg-opacity-10 text-video-context-type-secondary hover:text-video-context-type-main transition-colors flex items-center justify-center cursor-pointer"
              onClick={() => reset()}
              aria-label="Reset all colour adjustments"
              title="Reset all"
            >
              <Icon icon={Icons.REPEAT} className="text-lg" />
            </button>
          ) : null
        }
      >
        Colour adjustments
      </Menu.BackLink>
      <Menu.Section className="pb-5">
        <div className="space-y-4 mt-3">
          <PictureControl field="brightness" label="Brightness" />
          <PictureControl field="contrast" label="Contrast" />
          <PictureControl field="saturation" label="Saturation" />
          <PictureControl field="hue" label="Hue" />
        </div>
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
