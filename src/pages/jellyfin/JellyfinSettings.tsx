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
import { Dropdown } from "@/components/form/Dropdown";
import { Icons } from "@/components/Icon";
import { GamepadSettings } from "@/components/player/jellyfin/GamepadSettings";
import { Heading1 } from "@/components/utils/Text";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { CaptionsPart } from "@/pages/parts/settings/CaptionsPart";
import { useOverlayStack } from "@/stores/interface/overlayStack";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { useLanguageStore } from "@/stores/language";
import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";
import { useTasteDashboardEnabled, useTasteStore } from "@/stores/taste";
import { getLocaleInfo } from "@/utils/language";

import { SettingGroup, SettingRow, SettingToggle } from "./settings/SettingRow";
import { SettingsLayout, SettingsPageSection } from "./settings/SettingsLayout";
import { SettingsTransfer } from "./settings/SettingsTransfer";
import { ThemeSettingsSection } from "./settings/ThemeSettingsSection";

export default function JellyfinSettings() {
  const language = useLanguageStore();
  const showModal = useOverlayStack((state) => state.showModal);
  const subtitles = useSubtitleStore();
  const preferences = usePreferencesStore();
  const tasteDashboardEnabled = useTasteDashboardEnabled();
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
      <SettingsLayout>
        <SettingsPageSection id="preferences">
          <Heading1 border>Preferences</Heading1>
          <p className="text-sm text-type-secondary">
            Signed in to Jellyfin as{" "}
            <span className="font-semibold text-white">
              {session?.userName}
            </span>
            .
          </p>
          <SettingGroup title="Language" icon={Icons.CAPTIONS}>
            <SettingRow
              title="Interface language"
              description="Language used for translated interface labels."
            >
              <Dropdown
                className="!my-0 w-full sm:min-w-56"
                options={Object.keys(locales).map((code) => ({
                  id: code,
                  name:
                    getLocaleInfo(code)?.nativeName ??
                    getLocaleInfo(code)?.name ??
                    code,
                }))}
                selectedItem={{
                  id: language.language,
                  name:
                    getLocaleInfo(language.language)?.nativeName ??
                    getLocaleInfo(language.language)?.name ??
                    language.language,
                }}
                setSelectedItem={(item) => language.setLanguage(item.id)}
              />
            </SettingRow>
          </SettingGroup>
          <SettingGroup title="Recommendations" icon={Icons.HEART}>
            <SettingToggle
              title="Taste profile and quiz"
              description="Enable optional title ratings and the taste quiz. Turning this off keeps your saved ratings and preferences."
              enabled={tasteDashboardEnabled}
              onChange={(dashboardEnabled) =>
                useTasteStore.getState().setPreferences({ dashboardEnabled })
              }
            />
            {tasteDashboardEnabled ? (
              <SettingRow title="Your taste">
                <Button theme="secondary" href="/taste">
                  Open taste profile
                </Button>
              </SettingRow>
            ) : null}
          </SettingGroup>
          <div className="grid gap-8 xl:grid-cols-2">
            <SettingGroup title="Player controls" icon={Icons.TACHOMETER}>
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
              <div className="px-4 py-3">
                <h2 className="mb-4 font-bold text-white">Game controller</h2>
                <GamepadSettings />
              </div>
            </SettingGroup>
            <SettingGroup title="Performance" icon={Icons.SETTINGS}>
              <SettingToggle
                title="Low performance mode"
                description="Reduce background effects and card animations to use fewer resources."
                enabled={preferences.enableLowPerformanceMode}
                onChange={preferences.setEnableLowPerformanceMode}
              />
            </SettingGroup>
          </div>
        </SettingsPageSection>
        <SettingsPageSection id="appearance">
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="space-y-8">
              <Heading1 border>Appearance</Heading1>
              <SettingGroup title="Appearance" icon={Icons.BRUSH}>
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
              </SettingGroup>
              <SettingGroup title="Player UI" icon={Icons.PLAY}>
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
              </SettingGroup>
            </div>
            <ThemeSettingsSection />
          </div>
        </SettingsPageSection>
        <SettingsPageSection id="playback">
          <Heading1 border>Jellyfin playback</Heading1>
          <SettingGroup title="Languages and playback" icon={Icons.PLAY}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
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
          </SettingGroup>
        </SettingsPageSection>
        <SettingsPageSection id="captions">
          <CaptionsPart
            styling={subtitles.styling}
            setStyling={subtitles.updateStyling}
          />
        </SettingsPageSection>
        <SettingsPageSection id="connections">
          <Heading1 border>Connections</Heading1>
          <SettingGroup title="Connections" icon={Icons.LINK}>
            <SettingRow
              title="Watch history"
              description="Import Letterboxd watched films and manage optional external service connections."
            >
              <Button theme="secondary" href="/settings/integrations">
                Manage integrations
              </Button>
            </SettingRow>
          </SettingGroup>
        </SettingsPageSection>
        <SettingsPageSection id="backup">
          <SettingsTransfer />
        </SettingsPageSection>
      </SettingsLayout>
    </SubPageLayout>
  );
}
