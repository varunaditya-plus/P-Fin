import { useTranslation } from "react-i18next";

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
          <CaptionsPart
            styling={subtitles.styling}
            setStyling={subtitles.updateStyling}
          />
        </div>
      </WideContainer>
    </SubPageLayout>
  );
}
