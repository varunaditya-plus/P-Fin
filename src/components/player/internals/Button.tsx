import classNames from "classnames";
import { forwardRef } from "react";

import { Icon, Icons } from "@/components/Icon";

export interface VideoPlayerButtonProps {
  children?: React.ReactNode;
  label?: string;
  onClick?: (el: HTMLButtonElement) => void;
  icon?: Icons;
  iconSizeClass?: string;
  className?: string;
  activeClass?: string;
}

const iconLabels: Partial<Record<Icons, string>> = {
  [Icons.PLAY]: "Play",
  [Icons.PAUSE]: "Pause",
  [Icons.GEAR]: "Player settings",
  [Icons.CAPTIONS]: "Subtitles",
  [Icons.EXPAND]: "Enter fullscreen",
  [Icons.COMPRESS]: "Exit fullscreen",
  [Icons.SKIP_FORWARD]: "Seek forward",
  [Icons.SKIP_BACKWARD]: "Seek backward",
  [Icons.SKIP_EPISODE]: "Next episode",
  [Icons.EPISODES]: "Episodes",
  [Icons.AIRPLAY]: "AirPlay",
  [Icons.PICTURE_IN_PICTURE]: "Picture in picture",
  [Icons.CIRCLE_QUESTION]: "Title details",
  [Icons.VOLUME]: "Mute",
  [Icons.VOLUME_LOW]: "Mute",
  [Icons.VOLUME_MED]: "Mute",
  [Icons.VOLUME_X]: "Unmute",
  [Icons.BOOKMARK]: "Remove from favourites",
  [Icons.BOOKMARK_OUTLINE]: "Add to favourites",
  [Icons.STRETCH]: "Widescreen",
  [Icons.SHRINK]: "Original aspect ratio",
};

export const VideoPlayerButton = forwardRef<
  HTMLButtonElement,
  VideoPlayerButtonProps
>((props, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={
        props.label ??
        (!props.children && props.icon ? iconLabels[props.icon] : undefined)
      }
      onClick={(e) => props.onClick?.(e.currentTarget as HTMLButtonElement)}
      className={classNames([
        "tabbable p-2 rounded-full hover:bg-video-buttonBackground hover:bg-opacity-50 transition-transform duration-100 flex items-center gap-3",
        props.activeClass ??
          "active:scale-110 active:bg-opacity-75 active:text-white",
        props.className ?? "",
      ])}
    >
      {props.icon && (
        <Icon className={props.iconSizeClass || "text-2xl"} icon={props.icon} />
      )}
      {props.children}
    </button>
  );
});
