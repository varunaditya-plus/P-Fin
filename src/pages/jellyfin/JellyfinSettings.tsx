import { useEffect, useRef, useState } from "react";

import { locales } from "@/assets/languages";
import {
  JellyfinCulture,
  JellyfinUserConfiguration,
  SubtitleMode,
  getCultures,
  getUserConfiguration,
  updateUserConfiguration,
} from "@/backend/jellyfin/preferences";
import { Button } from "@/components/buttons/Button";
import { WideContainer } from "@/components/layout/WideContainer";
import { GamepadSettings } from "@/components/player/jellyfin/GamepadSettings";
import { Heading1 } from "@/components/utils/Text";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { CaptionsPart } from "@/pages/parts/settings/CaptionsPart";
import { useOverlayStack } from "@/stores/interface/overlayStack";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { useLanguageStore } from "@/stores/language";
import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";
import { getLocaleInfo } from "@/utils/language";

import { SettingRow, SettingToggle } from "./settings/SettingRow";
import { SettingsTransfer } from "./settings/SettingsTransfer";
import { ThemeSettingsSection } from "./settings/ThemeSettingsSection";

export default function JellyfinSettings() {
  const language = useLanguageStore();
  const showModal = useOverlayStack((state) => state.showModal);
  const subtitles = useSubtitleStore();
  const preferences = usePreferencesStore();
  const session = useJellyfinAuth((state) => state.session);
  const [configuration, setConfiguration] =
    useState<JellyfinUserConfiguration | null>(null);
  const [cultures, setCultures] = useState<JellyfinCulture[]>([]);
  const [loadingPlayback, setLoadingPlayback] = useState(true);
  const [savingPlayback, setSavingPlayback] = useState(false);
  const savingPlaybackRef = useRef(false);
  const [playbackError, setPlaybackError] = useState("");
  const [playbackSaved, setPlaybackSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const controller = new AbortController();
    setLoadingPlayback(true);
    setConfiguration(null);
    setPlaybackError("");
    Promise.all([
      getUserConfiguration(controller.signal),
      getCultures(controller.signal).catch(() => [] as JellyfinCulture[]),
    ])
      .then(([userConfiguration, languages]) => {
        if (controller.signal.aborted) return;
        setConfiguration(userConfiguration);
        setCultures(
          [
            ...new Map(
              languages
                .filter((culture) => culture.ThreeLetterISOLanguageName)
                .map((culture) => [
                  culture.ThreeLetterISOLanguageName,
                  culture,
                ]),
            ).values(),
          ].sort((a, b) => a.DisplayName.localeCompare(b.DisplayName)),
        );
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setPlaybackError(
            reason instanceof Error
              ? reason.message
              : "Unable to load Jellyfin playback settings.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlayback(false);
      });
    return () => controller.abort();
  }, [session?.serverUrl, session?.userId, session?.accessToken, retry]);

  const savePlayback = async (patch: Partial<JellyfinUserConfiguration>) => {
    if (!configuration || savingPlaybackRef.current) return;
    const savingSession = session;
    savingPlaybackRef.current = true;
    setSavingPlayback(true);
    setPlaybackError("");
    setPlaybackSaved(false);
    try {
      const updated = await updateUserConfiguration(patch);
      if (sessionRef.current !== savingSession) return;
      setConfiguration(updated);
      setPlaybackSaved(true);
    } catch (reason: unknown) {
      if (sessionRef.current !== savingSession) return;
      setPlaybackError(
        reason instanceof Error
          ? reason.message
          : "Unable to save Jellyfin playback settings.",
      );
    } finally {
      savingPlaybackRef.current = false;
      setSavingPlayback(false);
    }
  };

  const languageOptions = (selected?: string | null) => {
    const options = cultures.map((culture) => ({
      value: culture.ThreeLetterISOLanguageName || "",
      label: culture.DisplayName,
    }));
    if (selected && !options.some((option) => option.value === selected))
      options.unshift({ value: selected, label: selected });
    return options;
  };

  const playbackToggle = (
    title: string,
    description: string,
    key:
      | "PlayDefaultAudioTrack"
      | "RememberAudioSelections"
      | "RememberSubtitleSelections"
      | "EnableNextEpisodeAutoPlay",
  ) => (
    <SettingToggle
      title={title}
      description={description}
      enabled={configuration?.[key] ?? true}
      disabled={!configuration || savingPlayback}
      onChange={(enabled) => {
        savePlayback({ [key]: enabled });
      }}
    />
  );

  return (
    <SubPageLayout>
      <WideContainer>
        <div className="space-y-12 pb-12">
          <Heading1 border>Settings</Heading1>
          <p>
            Signed in to Jellyfin as{" "}
            <span className="font-bold text-white">{session?.userName}</span>.
          </p>
          <section className="space-y-4">
            <Heading1 border>Language</Heading1>
            <SettingRow
              title="Interface language"
              description="Language used for translated interface labels."
            >
              <select
                aria-label="Interface language"
                value={language.language}
                onChange={(event) => language.setLanguage(event.target.value)}
                className="max-w-full rounded-lg bg-background-secondary p-3 text-white tabbable"
              >
                {Object.keys(locales).map((code) => (
                  <option key={code} value={code}>
                    {getLocaleInfo(code)?.nativeName ??
                      getLocaleInfo(code)?.name ??
                      code}
                  </option>
                ))}
              </select>
            </SettingRow>
          </section>
          <ThemeSettingsSection />
          <section className="space-y-4">
            <Heading1 border>Home</Heading1>
            <SettingToggle
              title="Featured carousel"
              description="Show a featured title at the top of your library and Discover."
              enabled={preferences.enableFeatured}
              onChange={preferences.setEnableFeatured}
            />
            <SettingToggle
              title="Image logos"
              description="Use title artwork when it is available."
              enabled={preferences.enableImageLogos}
              onChange={preferences.setEnableImageLogos}
            />
            <SettingToggle
              title="Minimal cards"
              description="Keep title cards compact with fewer details."
              enabled={preferences.enableMinimalCards}
              onChange={preferences.setEnableMinimalCards}
            />
          </section>
          <section className="space-y-4">
            <Heading1 border>Player interface</Heading1>
            <SettingToggle
              title="Pause overlay"
              description="Show title information while playback is paused."
              enabled={preferences.enablePauseOverlay}
              onChange={preferences.setEnablePauseOverlay}
            />
            <SettingToggle
              title="Compact episode list"
              description="Use a compact list in the player episode menu."
              enabled={preferences.forceCompactEpisodeView}
              onChange={preferences.setForceCompactEpisodeView}
            />
          </section>
          <section className="space-y-4">
            <Heading1 border>Controls</Heading1>
            <SettingToggle
              title="Hold to boost"
              description="Hold the video to temporarily increase playback speed."
              enabled={preferences.enableHoldToBoost}
              onChange={preferences.setEnableHoldToBoost}
            />
            <SettingToggle
              title="Double-click to seek"
              description="Double-click either side of the video to seek."
              enabled={preferences.enableDoubleClickToSeek}
              onChange={preferences.setEnableDoubleClickToSeek}
            />
            <SettingToggle
              title="Number key seeking"
              description="Use number keys to jump to a position in the video."
              enabled={preferences.enableNumberKeySeeking}
              onChange={preferences.setEnableNumberKeySeeking}
            />
            <SettingRow
              title="Keyboard shortcuts"
              description="Change player shortcuts and review fixed keys."
            >
              <Button
                theme="secondary"
                onClick={() => showModal("keyboard-commands-edit")}
              >
                Configure shortcuts
              </Button>
            </SettingRow>
            <div className="rounded-lg bg-dropdown-background px-5 py-4">
              <h2 className="mb-4 font-bold text-white">Game controller</h2>
              <GamepadSettings />
            </div>
          </section>
          <section className="space-y-4">
            <Heading1 border>Performance</Heading1>
            <SettingToggle
              title="Low performance mode"
              description="Reduce background effects and card animations to use fewer resources."
              enabled={preferences.enableLowPerformanceMode}
              onChange={preferences.setEnableLowPerformanceMode}
            />
          </section>
          <section className="space-y-6">
            <Heading1 border>Jellyfin playback</Heading1>
            {loadingPlayback ? (
              <p className="text-type-secondary">
                Loading Jellyfin preferences…
              </p>
            ) : null}
            {playbackError ? (
              <div role="alert" className="space-y-3">
                <p className="text-type-danger">{playbackError}</p>
                {!configuration ? (
                  <Button
                    theme="secondary"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Try again
                  </Button>
                ) : null}
              </div>
            ) : null}
            {configuration ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[38rem]">
                  <label className="flex flex-col gap-2 text-sm text-type-secondary">
                    Preferred audio language
                    <select
                      value={configuration.AudioLanguagePreference || ""}
                      disabled={savingPlayback}
                      onChange={(event) =>
                        savePlayback({
                          AudioLanguagePreference: event.target.value,
                        })
                      }
                      className="bg-dropdown-background rounded-lg px-4 py-3 text-white"
                    >
                      <option value="">Any language</option>
                      <option value="OriginalLanguage">
                        Original language
                      </option>
                      {languageOptions(configuration.AudioLanguagePreference)
                        .filter((item) => item.value !== "OriginalLanguage")
                        .map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-type-secondary">
                    Preferred subtitle language
                    <select
                      value={configuration.SubtitleLanguagePreference || ""}
                      disabled={savingPlayback}
                      onChange={(event) =>
                        savePlayback({
                          SubtitleLanguagePreference: event.target.value,
                        })
                      }
                      className="bg-dropdown-background rounded-lg px-4 py-3 text-white"
                    >
                      <option value="">Any language</option>
                      {languageOptions(
                        configuration.SubtitleLanguagePreference,
                      ).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-type-secondary md:col-span-2">
                    Subtitle mode
                    <select
                      value={configuration.SubtitleMode ?? "Default"}
                      disabled={savingPlayback}
                      onChange={(event) =>
                        savePlayback({
                          SubtitleMode: event.target.value as SubtitleMode,
                        })
                      }
                      className="bg-dropdown-background rounded-lg px-4 py-3 text-white"
                    >
                      <option value="Default">Default</option>
                      <option value="Smart">
                        Smart — when audio differs from your language
                      </option>
                      <option value="OnlyForced">Forced subtitles only</option>
                      <option value="Always">Always show subtitles</option>
                      <option value="None">Never show subtitles</option>
                    </select>
                  </label>
                </div>
                {playbackToggle(
                  "Play default audio track",
                  "Prefer the file’s default track over the language preference.",
                  "PlayDefaultAudioTrack",
                )}
                {playbackToggle(
                  "Remember audio selections",
                  "Use a similar audio language for the next episode.",
                  "RememberAudioSelections",
                )}
                {playbackToggle(
                  "Remember subtitle selections",
                  "Keep your subtitle language or Off choice for the next episode.",
                  "RememberSubtitleSelections",
                )}
                {playbackToggle(
                  "Automatically play next episode",
                  "Start the next episode when the current one ends.",
                  "EnableNextEpisodeAutoPlay",
                )}
                <p aria-live="polite" className="text-sm text-type-secondary">
                  {savingPlayback
                    ? "Saving to Jellyfin…"
                    : playbackSaved
                      ? "Saved to Jellyfin."
                      : ""}
                </p>
              </>
            ) : null}
          </section>
          <CaptionsPart
            styling={subtitles.styling}
            setStyling={subtitles.updateStyling}
          />
          <SettingsTransfer />
        </div>
      </WideContainer>
    </SubPageLayout>
  );
}
