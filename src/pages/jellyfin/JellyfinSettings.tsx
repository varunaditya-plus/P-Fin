import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  JellyfinCulture,
  JellyfinUserConfiguration,
  SubtitleMode,
  getCultures,
  getUserConfiguration,
  updateUserConfiguration,
} from "@/backend/jellyfin/preferences";
import { Button } from "@/components/buttons/Button";
import { Toggle } from "@/components/buttons/Toggle";
import { WideContainer } from "@/components/layout/WideContainer";
import { Heading1 } from "@/components/utils/Text";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import {
  ThemePreview,
  availableThemes,
} from "@/pages/parts/settings/AppearancePart";
import { CaptionsPart } from "@/pages/parts/settings/CaptionsPart";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";
import { useThemeStore } from "@/stores/theme";

export default function JellyfinSettings() {
  const { t } = useTranslation();
  const theme = useThemeStore();
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

  useEffect(() => {
    const controller = new AbortController();
    setLoadingPlayback(true);
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
  }, [session?.userId, session?.accessToken, retry]);

  const savePlayback = async (patch: Partial<JellyfinUserConfiguration>) => {
    if (!configuration || savingPlaybackRef.current) return;
    savingPlaybackRef.current = true;
    setSavingPlayback(true);
    setPlaybackError("");
    setPlaybackSaved(false);
    try {
      const updated = await updateUserConfiguration(patch);
      setConfiguration(updated);
      setPlaybackSaved(true);
    } catch (reason: unknown) {
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
    <div className="bg-dropdown-background select-none flex items-center gap-4 max-w-[38rem] py-3 px-4 rounded-lg">
      <Toggle
        enabled={configuration?.[key] ?? true}
        disabled={!configuration || savingPlayback}
        onClick={() => savePlayback({ [key]: !(configuration?.[key] ?? true) })}
      />
      <div>
        <p className="text-white font-bold">{title}</p>
        <p className="text-sm text-type-secondary">{description}</p>
      </div>
    </div>
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
          <section className="space-y-8">
            <Heading1 border>{t("settings.appearance.title")}</Heading1>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {availableThemes
                .filter((item) => item.id !== "custom")
                .map((item) => (
                  <ThemePreview
                    key={item.id}
                    selector={item.selector}
                    name={t(item.key)}
                    active={(theme.theme ?? "default") === item.id}
                    inUse={(theme.theme ?? "default") === item.id}
                    onClick={() => theme.setTheme(item.id)}
                  />
                ))}
            </div>
            {[
              {
                title: "Featured carousel",
                enabled: preferences.enableFeatured,
                set: preferences.setEnableFeatured,
              },
              {
                title: "Image logos",
                enabled: preferences.enableImageLogos,
                set: preferences.setEnableImageLogos,
              },
              {
                title: "Minimal cards",
                enabled: preferences.enableMinimalCards,
                set: preferences.setEnableMinimalCards,
              },
              {
                title: "Pause overlay",
                enabled: preferences.enablePauseOverlay,
                set: preferences.setEnablePauseOverlay,
              },
            ].map((option) => (
              <div
                key={option.title}
                className="bg-dropdown-background select-none space-x-3 flex items-center max-w-[25rem] py-3 px-4 rounded-lg"
              >
                <Toggle
                  enabled={option.enabled}
                  onClick={() => option.set(!option.enabled)}
                />
                <p className="flex-1 text-white font-bold">{option.title}</p>
              </div>
            ))}
          </section>
          <section className="space-y-6">
            <Heading1 border>Playback</Heading1>
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
        </div>
      </WideContainer>
    </SubPageLayout>
  );
}
