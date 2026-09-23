import classNames from "classnames";
import { ReactNode, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { Toggle } from "@/components/buttons/Toggle";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { SettingsCard } from "@/components/layout/SettingsCard";
import {
  CaptionSetting,
  ColorOption,
  SubtitleLayoutControls,
  colors,
} from "@/components/player/atoms/settings/CaptionSettingsView";
import { CaptionCue } from "@/components/player/Player";
import { Heading1 } from "@/components/utils/Text";
import { Transition } from "@/components/utils/Transition";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { SubtitleStyling, useSubtitleStore } from "@/stores/subtitles";

export function CaptionPreview(props: {
  fullscreen?: boolean;
  show?: boolean;
  styling: SubtitleStyling;
  overrideCasing?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { fullscreen, show, onToggle } = props;

  useEffect(() => {
    if (!fullscreen || !show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreen, show, onToggle]);

  return (
    <div
      className={classNames({
        "pointer-events-none overflow-hidden w-full": true,
        "relative h-44 rounded-xl border border-settings-card-border/60 bg-background-secondary shadow-inner":
          !props.fullscreen,
        "fixed inset-0 z-[999]": props.fullscreen,
      })}
    >
      {props.fullscreen && props.show ? (
        <Helmet>
          <html data-no-scroll />
        </Helmet>
      ) : null}
      <Transition animation="fade" show={props.show}>
        <div className="absolute inset-0 pointer-events-auto bg-background-secondary">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-progress-filled/10 to-black/50" />
          <button
            type="button"
            aria-label={
              props.fullscreen
                ? "Close subtitle preview"
                : "Expand subtitle preview"
            }
            className="tabbable bg-black absolute right-3 top-3 text-white bg-opacity-25 duration-100 transition-[background-color,transform] active:scale-110 hover:bg-opacity-50 p-2 rounded-md cursor-pointer"
            onClick={props.onToggle}
          >
            <Icon icon={props.fullscreen ? Icons.X : Icons.EXPAND} />
          </button>

          <div
            className="text-white pointer-events-none absolute flex w-full flex-col items-center transition-[bottom] p-4"
            style={{
              bottom: `${props.styling.verticalPosition * (props.fullscreen ? 16 : 11)}px`,
            }}
          >
            <div className={props.fullscreen ? "" : "text-[0.85rem]"}>
              <CaptionCue
                text={t("settings.subtitles.previewQuote") ?? undefined}
                styling={props.styling}
                overrideCasing={props.overrideCasing ?? false}
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  );
}

function CaptionRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4 py-1">
      <div>
        <p className="text-white font-bold">{title}</p>
        {description ? (
          <p className="text-type-secondary text-sm mt-0.5 max-w-[24rem]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex justify-center items-center shrink-0">
        {children}
      </div>
    </div>
  );
}

export function CaptionsPart(props: {
  styling: SubtitleStyling;
  setStyling: (s: SubtitleStyling) => void;
}) {
  const { t } = useTranslation();
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const subtitleStore = useSubtitleStore();
  const preferencesStore = usePreferencesStore();
  const setCaptionAsTrack = usePlayerStore((s) => s.setCaptionAsTrack);
  const enableNativeSubtitles = preferencesStore.enableNativeSubtitles;
  useEffect(() => {
    subtitleStore.updateStyling(props.styling);
  }, [props.styling, subtitleStore, subtitleStore.updateStyling]);
  useEffect(() => {
    setCaptionAsTrack(enableNativeSubtitles);
  }, [enableNativeSubtitles, setCaptionAsTrack]);
  const change = (newStyling: SubtitleStyling) => {
    props.setStyling(newStyling);
    subtitleStore.updateStyling(newStyling);
  };
  const reset = () => {
    subtitleStore.resetStyling();
    props.setStyling(useSubtitleStore.getState().styling);
  };
  const defaults = useSubtitleStore.getInitialState().styling;
  const changed = Object.entries(defaults).some(
    ([key, value]) => props.styling[key as keyof SubtitleStyling] !== value,
  );
  const titleClassName = "text-white font-bold";
  const headingClassName =
    "text-white font-bold text-base border-b border-settings-card-border/40 pb-3";
  return (
    <div className="space-y-8">
      <Heading1 border>{t("settings.subtitles.title")}</Heading1>
      {!enableNativeSubtitles ? (
        <div>
          <p className="text-white font-bold mb-3">Preview</p>
          <CaptionPreview
            show
            styling={props.styling}
            overrideCasing={subtitleStore.overrideCasing}
            onToggle={() => setFullscreenPreview(true)}
          />
          <CaptionPreview
            show={fullscreenPreview}
            fullscreen
            styling={props.styling}
            overrideCasing={subtitleStore.overrideCasing}
            onToggle={() => setFullscreenPreview(false)}
          />
        </div>
      ) : null}
      <div className="space-y-6">
        {!enableNativeSubtitles ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch relative z-20">
            <SettingsCard className="space-y-5 h-full flex flex-col justify-start relative z-30">
              <h2 className={headingClassName}>Text &amp; Typography</h2>
              <CaptionSetting
                titleClassName={titleClassName}
                label={t("settings.subtitles.textSizeLabel")}
                max={200}
                min={1}
                textTransformer={(value) => `${value}%`}
                onChange={(size) =>
                  change({ ...props.styling, size: size / 100 })
                }
                value={props.styling.size * 100}
              />
              <SubtitleLayoutControls
                settings
                styling={props.styling}
                onChange={change}
              />
              <CaptionRow title={t("settings.subtitles.textStyle.title")}>
                <Dropdown
                  className="!my-0"
                  options={[
                    "default",
                    "raised",
                    "depressed",
                    "Border",
                    "dropShadow",
                  ].map((id) => ({
                    id,
                    name: t(`settings.subtitles.textStyle.${id}`),
                  }))}
                  selectedItem={{
                    id: props.styling.fontStyle,
                    name:
                      t(
                        `settings.subtitles.textStyle.${props.styling.fontStyle}`,
                      ) || props.styling.fontStyle,
                  }}
                  setSelectedItem={(item) =>
                    change({ ...props.styling, fontStyle: item.id })
                  }
                />
              </CaptionRow>
              {props.styling.fontStyle === "Border" ? (
                <CaptionSetting
                  titleClassName={titleClassName}
                  label={t("settings.subtitles.BorderThicknessLabel")}
                  min={0}
                  max={10}
                  value={props.styling.borderThickness}
                  decimalsAllowed={1}
                  onChange={(borderThickness) =>
                    change({ ...props.styling, borderThickness })
                  }
                  textTransformer={(value) => `${value}px`}
                />
              ) : null}
              <CaptionRow title={t("settings.subtitles.colorLabel")}>
                <div className="flex justify-center items-center space-x-1 sm:space-x-2">
                  {colors.map((color) => (
                    <ColorOption
                      key={color}
                      color={color}
                      active={
                        props.styling.color.toLowerCase() ===
                        color.toLowerCase()
                      }
                      onClick={() => change({ ...props.styling, color })}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      aria-label="Custom subtitle colour"
                      value={props.styling.color.slice(0, 7)}
                      onChange={(event) =>
                        change({ ...props.styling, color: event.target.value })
                      }
                      className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8"
                    />
                    <div style={{ color: props.styling.color }}>
                      <Icon icon={Icons.BRUSH} className="text-xl" />
                    </div>
                  </div>
                </div>
              </CaptionRow>
              <CaptionRow title={t("settings.subtitles.textBoldLabel")}>
                <Toggle
                  label={t("settings.subtitles.textBoldLabel")}
                  enabled={props.styling.bold}
                  onClick={() =>
                    change({ ...props.styling, bold: !props.styling.bold })
                  }
                />
              </CaptionRow>
            </SettingsCard>
            <SettingsCard className="space-y-5 h-full flex flex-col justify-start">
              <h2 className={headingClassName}>Background &amp; Effects</h2>
              <CaptionSetting
                titleClassName={titleClassName}
                label={t("settings.subtitles.backgroundLabel")}
                min={0}
                max={100}
                value={props.styling.backgroundOpacity * 100}
                onChange={(backgroundOpacity) =>
                  change({
                    ...props.styling,
                    backgroundOpacity: backgroundOpacity / 100,
                  })
                }
                textTransformer={(value) => `${value}%`}
              />
              <CaptionRow
                title={t("settings.subtitles.backgroundBlurEnabledLabel")}
                description={t(
                  "settings.subtitles.backgroundBlurEnabledDescription",
                )}
              >
                <Toggle
                  label={t("settings.subtitles.backgroundBlurEnabledLabel")}
                  enabled={props.styling.backgroundBlurEnabled}
                  onClick={() =>
                    change({
                      ...props.styling,
                      backgroundBlurEnabled:
                        !props.styling.backgroundBlurEnabled,
                    })
                  }
                />
              </CaptionRow>
              {props.styling.backgroundBlurEnabled ? (
                <CaptionSetting
                  titleClassName={titleClassName}
                  label={t("settings.subtitles.backgroundBlurLabel")}
                  min={0}
                  max={100}
                  value={props.styling.backgroundBlur * 100}
                  onChange={(backgroundBlur) =>
                    change({
                      ...props.styling,
                      backgroundBlur: backgroundBlur / 100,
                    })
                  }
                  textTransformer={(value) => `${value}%`}
                />
              ) : null}
              <CaptionSetting
                titleClassName={titleClassName}
                label="Corner rounding"
                min={0}
                max={16}
                value={props.styling.backgroundRadius ?? 4}
                onChange={(backgroundRadius) =>
                  change({ ...props.styling, backgroundRadius })
                }
                textTransformer={(value) => `${value}px`}
              />
            </SettingsCard>
          </div>
        ) : null}
        <SettingsCard className="space-y-5">
          <h2 className={headingClassName}>Behaviour</h2>
          {!enableNativeSubtitles ? (
            <CaptionRow
              title={t("player.menus.subtitles.settings.fixCapitals")}
            >
              <Toggle
                label={t("player.menus.subtitles.settings.fixCapitals")}
                enabled={subtitleStore.overrideCasing}
                onClick={() =>
                  subtitleStore.setOverrideCasing(!subtitleStore.overrideCasing)
                }
              />
            </CaptionRow>
          ) : null}
          <CaptionRow
            title={t("player.menus.subtitles.useNativeSubtitles")}
            description={t(
              "player.menus.subtitles.useNativeSubtitlesDescription",
            )}
          >
            <Toggle
              label={t("player.menus.subtitles.useNativeSubtitles")}
              enabled={enableNativeSubtitles}
              onClick={() =>
                preferencesStore.setEnableNativeSubtitles(
                  !enableNativeSubtitles,
                )
              }
            />
          </CaptionRow>
        </SettingsCard>
      </div>
      {!enableNativeSubtitles ? (
        <div className="flex justify-end pt-2">
          <Button
            theme="secondary"
            onClick={reset}
            disabled={!changed}
            className="flex items-center gap-2"
          >
            <Icon icon={Icons.ARROW_LEFT} />
            Reset to Default
          </Button>
        </div>
      ) : null}
    </div>
  );
}
