import { useMemo } from "react";

import {
  captionIsVisible,
  makeQueId,
  parseSubtitles,
  sanitize,
} from "@/components/player/utils/captions";
import { TimedTextCue, isTTML } from "@/components/player/utils/ttml";
import { Transition } from "@/components/utils/Transition";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { SubtitleStyling, useSubtitleStore } from "@/stores/subtitles";

export const wordOverrides: Record<string, string> = {
  // Example: i: "I", but in polish "i" is "and" so this is disabled.
};

export function CaptionCue({
  text,
  styling,
  overrideCasing,
  timedTextStyle,
}: {
  text?: string;
  styling: SubtitleStyling;
  overrideCasing: boolean;
  timedTextStyle?: TimedTextCue["style"];
}) {
  const parsedHtml = useMemo(() => {
    let textToUse = text;
    if (overrideCasing && text) {
      textToUse = text.slice(0, 1) + text.slice(1).toLowerCase();
    }

    const textWithNewlines = (textToUse || "")
      .split(" ")
      .map((word) => wordOverrides[word] ?? word)
      .join(" ")
      .replaceAll(/ i'/g, " I'")
      .replaceAll(/\r?\n/g, "<br />");

    // https://www.w3.org/TR/webvtt1/#dom-construction-rules
    // added a <br /> for newlines
    const html = sanitize(textWithNewlines, {
      ALLOWED_TAGS: ["c", "b", "i", "u", "span", "ruby", "rt", "br"],
      ADD_TAGS: ["v", "lang"],
      ALLOWED_ATTR: timedTextStyle
        ? ["title", "lang", "style"]
        : ["title", "lang"],
    });

    return html;
  }, [text, overrideCasing, timedTextStyle]);

  const getTextEffectStyles = () => {
    switch (styling.fontStyle) {
      case "raised":
        return {
          textShadow: "0 2px 0 rgba(0,0,0,0.8), 0 1.5px 1.5px rgba(0,0,0,0.9)",
        };
      case "depressed":
        return {
          textShadow:
            "0 -2px 0 rgba(0,0,0,0.8), 0 -1.5px 1.5px rgba(0,0,0,0.9)",
        };
      case "Border": {
        const thickness = Math.max(
          0.5,
          Math.min(5, styling.borderThickness || 1),
        );
        const shadowColor = "rgba(0,0,0,0.8)";
        return {
          textShadow: [
            `${thickness}px ${thickness}px 0 ${shadowColor}`,
            `-${thickness}px ${thickness}px 0 ${shadowColor}`,
            `${thickness}px -${thickness}px 0 ${shadowColor}`,
            `-${thickness}px -${thickness}px 0 ${shadowColor}`,
            `${thickness}px 0 0 ${shadowColor}`,
            `-${thickness}px 0 0 ${shadowColor}`,
            `0 ${thickness}px 0 ${shadowColor}`,
            `0 -${thickness}px 0 ${shadowColor}`,
          ].join(", "),
        };
      }
      case "dropShadow":
        return { textShadow: "2.5px 2.5px 4.5px rgba(0,0,0,0.9)" };
      case "default":
      default:
        return { textShadow: "0 2px 4px rgba(0,0,0,0.5)" }; // Default is a light drop shadow
    }
  };

  const textEffectStyles = getTextEffectStyles();

  return (
    <p
      className="mb-1 rounded px-4 py-1 text-center leading-normal"
      style={{
        color: styling.color,
        lineHeight: styling.lineHeight,
        fontSize: `${(1.5 * styling.size).toFixed(2)}em`,
        backgroundColor: `rgba(0,0,0,${styling.backgroundOpacity.toFixed(2)})`,
        backdropFilter:
          styling.backgroundBlurEnabled && styling.backgroundBlur !== 0
            ? `blur(${Math.floor(styling.backgroundBlur * 64)}px)`
            : "none",
        fontWeight: styling.bold ? "bold" : "normal",
        ...textEffectStyles,
        ...timedTextStyle,
      }}
    >
      <span
        // Sanitised a few lines up
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: parsedHtml,
        }}
        dir="ltr"
      />
    </p>
  );
}

export function SubtitleRenderer() {
  const videoTime = usePlayerStore((s) => s.progress.time);
  const srtData = usePlayerStore((s) => s.caption.selected?.srtData);
  const language = usePlayerStore((s) => s.caption.selected?.language);
  const styling = useSubtitleStore((s) => s.styling);
  const overrideCasing = useSubtitleStore((s) => s.overrideCasing);
  const delay = useSubtitleStore((s) => s.delay);

  const parsedCaptions = useMemo(
    () => (srtData ? parseSubtitles(srtData, language) : []),
    [srtData, language],
  );

  const visibleCaptions = useMemo(
    () =>
      parsedCaptions.filter(({ start, end }) =>
        captionIsVisible(start, end, delay, videoTime),
      ),
    [parsedCaptions, videoTime, delay],
  );

  return (
    <div>
      {visibleCaptions.map(({ start, end, content, region, style }, i) => {
        const cue = (
          <CaptionCue
            text={content}
            styling={styling}
            overrideCasing={overrideCasing}
            timedTextStyle={style}
          />
        );
        return style ? (
          <div
            key={makeQueId(i, start, end)}
            className="absolute flex flex-col"
            style={{
              left: `${region?.x ?? 10}%`,
              top: `${region?.y ?? 75}%`,
              width: `${region?.width ?? 80}%`,
              height: `${region?.height ?? 20}%`,
              justifyContent: region?.align ?? "end",
            }}
          >
            {cue}
          </div>
        ) : (
          <div key={makeQueId(i, start, end)}>{cue}</div>
        );
      })}
    </div>
  );
}

export function SubtitleView(props: { controlsShown: boolean }) {
  const caption = usePlayerStore((s) => s.caption.selected);
  const source = usePlayerStore((s) => s.source);
  const needsNativeTrack = usePlayerStore((s) => s.caption.asTrack);
  const styling = useSubtitleStore((s) => s.styling);
  const enableNativeSubtitles = usePreferencesStore(
    (s) => s.enableNativeSubtitles,
  );

  // Hide custom captions when native subtitles are enabled
  const shouldUseNativeTrack =
    (enableNativeSubtitles || needsNativeTrack) && source !== null;
  if (shouldUseNativeTrack || !caption) return null;

  if (isTTML(caption.srtData))
    return (
      <div className="pointer-events-none z-50 text-white absolute inset-0">
        <SubtitleRenderer />
      </div>
    );

  return (
    <Transition animation="slide-up" show>
      <div
        className="pointer-events-none z-50 text-white absolute w-full flex flex-col items-center transition-[bottom]"
        style={{
          bottom: props.controlsShown
            ? "6rem"
            : `${styling.verticalPosition}rem`,
          transform: "translateZ(0)",
        }}
      >
        <SubtitleRenderer />
      </div>
    </Transition>
  );
}
