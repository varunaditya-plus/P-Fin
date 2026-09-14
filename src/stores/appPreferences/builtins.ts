import { locales } from "@/assets/languages";
import {
  DEFAULT_VIDEO_APPEARANCE,
  normalizeVideoAppearance,
} from "@/components/player/display/videoAppearance";
import {
  normalizeBoostByTitle,
  usePlaybackEnhancements,
} from "@/components/player/enhancements/preferences";
import {
  defaultGamepadMapping,
  useGamepadStore,
  validateGamepad,
} from "@/stores/gamepad";
import { useJellyfinAuth } from "@/stores/jellyfin";
import {
  HomePreferences,
  defaultHomePreferences,
  homePreferenceScope,
  useHomePreferences,
} from "@/stores/jellyfin/home";
import { useLanguageStore } from "@/stores/language";
import { PreferencesStore, usePreferencesStore } from "@/stores/preferences";
import { SubtitleStore, useSubtitleStore } from "@/stores/subtitles";
import { useThemeStore } from "@/stores/theme";
import {
  defaultThemeSettings,
  validateThemeSettings,
} from "@/stores/theme/customThemes";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  LOCKED_SHORTCUT_IDS,
} from "@/utils/keyboardShortcuts";

import { registerBrowsePreferences } from "./browseSection";
import { registerAppPreferenceSection } from "./registry";

const booleans = [
  "enableFeatured",
  "enableImageLogos",
  "enableMinimalCards",
  "forceCompactEpisodeView",
  "enableLowPerformanceMode",
  "enableNativeSubtitles",
  "enableHoldToBoost",
  "enableDoubleClickToSeek",
  "enableNumberKeySeeking",
  "enablePauseOverlay",
] as const;
type ClientPreferences = Pick<
  PreferencesStore,
  (typeof booleans)[number] | "keyboardShortcuts"
>;
export function clientPreferenceSnapshot(
  state: PreferencesStore,
): ClientPreferences {
  return {
    ...Object.fromEntries(booleans.map((key) => [key, state[key]])),
    keyboardShortcuts: state.keyboardShortcuts,
  } as ClientPreferences;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid settings group.");
  return value as Record<string, unknown>;
}
export function validateHomePreferences(value: unknown): HomePreferences {
  const input = object(value);
  for (const key of ["order", "hidden"]) {
    if (
      !Array.isArray(input[key]) ||
      (input[key] as unknown[]).length > 1000 ||
      (input[key] as unknown[]).some(
        (id) => typeof id !== "string" || id.length > 200,
      )
    )
      throw new Error("Invalid home section list.");
  }
  if (
    !["comfortable", "compact"].includes(input.density as string) ||
    !["carousel", "grid"].includes(input.layout as string) ||
    !Number.isInteger(input.rows) ||
    (input.rows as number) < 1 ||
    (input.rows as number) > 10
  )
    throw new Error("Invalid home layout.");
  const sections: NonNullable<HomePreferences["sections"]> = {};
  if (input.sections !== undefined) {
    const sectionInput = object(input.sections);
    if (Object.keys(sectionInput).length > 1000)
      throw new Error("Invalid home section settings.");
    Object.entries(sectionInput).forEach(([id, sectionValue]) => {
      const section = object(sectionValue);
      if (
        !id ||
        id.length > 200 ||
        ["__proto__", "constructor", "prototype"].includes(id) ||
        (section.rows !== undefined &&
          (!Number.isInteger(section.rows) ||
            (section.rows as number) < 1 ||
            (section.rows as number) > 10)) ||
        (section.density !== undefined &&
          !["comfortable", "compact"].includes(section.density as string)) ||
        (section.editing !== undefined && typeof section.editing !== "boolean")
      )
        throw new Error("Invalid home section settings.");
      sections[id] = {
        ...(section.rows !== undefined ? { rows: section.rows as number } : {}),
        ...(section.density !== undefined
          ? { density: section.density as "comfortable" | "compact" }
          : {}),
        ...(section.editing !== undefined
          ? { editing: section.editing as boolean }
          : {}),
      };
    });
  }
  return {
    order: [...new Set(input.order as string[])],
    hidden: [...new Set(input.hidden as string[])],
    density: input.density as HomePreferences["density"],
    layout: input.layout as HomePreferences["layout"],
    rows: input.rows as number,
    sections,
  };
}
function currentBoostPrefix() {
  const session = useJellyfinAuth.getState().session;
  return session
    ? [
        session.serverId || session.serverAddress || session.serverUrl,
        session.userId,
      ]
    : [];
}
function currentBoostTitle(key: string) {
  try {
    const parts = JSON.parse(key);
    const prefix = currentBoostPrefix();
    return Array.isArray(parts) &&
      parts.length === 3 &&
      parts[0] === prefix[0] &&
      parts[1] === prefix[1] &&
      typeof parts[2] === "string"
      ? (parts[2] as string)
      : null;
  } catch {
    return null;
  }
}
export function currentAccountBoosts() {
  return Object.fromEntries(
    Object.entries(usePlaybackEnhancements.getState().boostByTitle).flatMap(
      ([key, value]) => {
        const title = currentBoostTitle(key);
        return title ? [[title, value]] : [];
      },
    ),
  );
}
export function applyAccountBoosts(value: Record<string, number>) {
  const state = usePlaybackEnhancements.getState();
  const boostByTitle = Object.fromEntries(
    Object.entries(state.boostByTitle).filter(
      ([key]) => currentBoostTitle(key) === null,
    ),
  );
  for (const [title, boost] of Object.entries(value))
    boostByTitle[JSON.stringify([...currentBoostPrefix(), title])] = boost;
  const activeTitle = state.activeTitle
    ? currentBoostTitle(state.activeTitle)
    : null;
  usePlaybackEnhancements.setState({
    boostByTitle,
    ...(activeTitle
      ? {
          boost: value[activeTitle] ?? 100,
          rememberBoost: value[activeTitle] !== undefined,
        }
      : {}),
  });
}
export function validateClientPreferences(value: unknown): ClientPreferences {
  const input = object(value);
  const result = clientPreferenceSnapshot(
    usePreferencesStore.getInitialState(),
  );
  for (const key of booleans) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "boolean")
        throw new Error(`Invalid ${key} setting.`);
      result[key] = input[key] as boolean;
    }
  }
  const shortcuts = object(
    input.keyboardShortcuts ?? DEFAULT_KEYBOARD_SHORTCUTS,
  );
  result.keyboardShortcuts = { ...DEFAULT_KEYBOARD_SHORTCUTS };
  for (const id of Object.keys(DEFAULT_KEYBOARD_SHORTCUTS)) {
    if (LOCKED_SHORTCUT_IDS.includes(id) || !shortcuts[id]) continue;
    const shortcut = object(shortcuts[id]);
    if (
      (shortcut.key !== undefined &&
        (typeof shortcut.key !== "string" || shortcut.key.length > 30)) ||
      (shortcut.modifier !== undefined &&
        shortcut.modifier !== "Shift" &&
        shortcut.modifier !== "Alt")
    )
      throw new Error("Invalid keyboard shortcut.");
    result.keyboardShortcuts[id] = {
      key: shortcut.key as string | undefined,
      modifier: shortcut.modifier as "Shift" | "Alt" | undefined,
    };
  }
  return result;
}
type SubtitlePreferences = Pick<SubtitleStore, "styling" | "overrideCasing">;
export function validateSubtitlePreferences(
  value: unknown,
): SubtitlePreferences {
  const input = object(value);
  const styling = object(input.styling);
  const result = { ...useSubtitleStore.getInitialState().styling };
  const bounds: Record<string, [number, number]> = {
    size: [0.01, 10],
    backgroundOpacity: [0, 1],
    backgroundBlur: [0, 1],
    verticalPosition: [0, 20],
    borderThickness: [0, 10],
    lineHeight: [0.8, 3],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    if (styling[key] === undefined) continue;
    if (
      typeof styling[key] !== "number" ||
      !Number.isFinite(styling[key]) ||
      (styling[key] as number) < min ||
      (styling[key] as number) > max
    )
      throw new Error(`Invalid subtitle ${key}.`);
    Object.assign(result, { [key]: styling[key] });
  }
  for (const key of ["bold", "backgroundBlurEnabled"] as const) {
    if (styling[key] !== undefined) {
      if (typeof styling[key] !== "boolean")
        throw new Error(`Invalid subtitle ${key}.`);
      result[key] = styling[key] as boolean;
    }
  }
  if (
    typeof styling.color !== "string" ||
    !/^#[\da-f]{6}([\da-f]{2})?$/i.test(styling.color)
  )
    throw new Error("Invalid subtitle colour.");
  result.color = styling.color.toLowerCase();
  if (
    typeof styling.fontStyle !== "string" ||
    !["default", "raised", "depressed", "Border", "dropShadow"].includes(
      styling.fontStyle,
    )
  )
    throw new Error("Invalid subtitle font style.");
  result.fontStyle = styling.fontStyle;
  if (typeof input.overrideCasing !== "boolean")
    throw new Error("Invalid subtitle casing.");
  return { styling: result, overrideCasing: input.overrideCasing };
}
let registered = false;
export function registerBuiltinPreferences() {
  if (registered) return;
  registered = true;
  registerBrowsePreferences();
  registerAppPreferenceSection("home", {
    label: "Library layout",
    defaults: defaultHomePreferences,
    localFallback: () =>
      useHomePreferences.getState().profiles[
        homePreferenceScope(useJellyfinAuth.getState().session)
      ] ?? defaultHomePreferences,
    getSnapshot: () =>
      useHomePreferences.getState().profiles[
        homePreferenceScope(useJellyfinAuth.getState().session)
      ] ?? defaultHomePreferences,
    apply: (value) =>
      useHomePreferences
        .getState()
        .update(homePreferenceScope(useJellyfinAuth.getState().session), value),
    subscribe: useHomePreferences.subscribe,
    validate: validateHomePreferences,
  });
  registerAppPreferenceSection("interface", {
    label: "Home and player controls",
    defaults: clientPreferenceSnapshot(usePreferencesStore.getInitialState()),
    getSnapshot: () => clientPreferenceSnapshot(usePreferencesStore.getState()),
    apply: (value) => usePreferencesStore.setState(value),
    subscribe: usePreferencesStore.subscribe,
    validate: validateClientPreferences,
  });
  registerAppPreferenceSection("themes", {
    label: "Themes",
    defaults: defaultThemeSettings,
    getSnapshot: () => validateThemeSettings(useThemeStore.getState()),
    apply: (value) => useThemeStore.setState(value),
    subscribe: useThemeStore.subscribe,
    validate: validateThemeSettings,
  });
  registerAppPreferenceSection("subtitles", {
    label: "Subtitle appearance",
    defaults: {
      styling: useSubtitleStore.getInitialState().styling,
      overrideCasing: false,
    },
    getSnapshot: () => ({
      styling: useSubtitleStore.getState().styling,
      overrideCasing: useSubtitleStore.getState().overrideCasing,
    }),
    apply: (value) => useSubtitleStore.setState(value),
    subscribe: useSubtitleStore.subscribe,
    validate: validateSubtitlePreferences,
  });
  registerAppPreferenceSection("gamepad", {
    label: "Controller mapping",
    defaults: { enabled: false, mapping: { ...defaultGamepadMapping } },
    getSnapshot: () => ({
      enabled: useGamepadStore.getState().enabled,
      mapping: useGamepadStore.getState().mapping,
    }),
    apply: (value) => useGamepadStore.setState(value),
    subscribe: useGamepadStore.subscribe,
    validate: validateGamepad,
  });
  registerAppPreferenceSection("picture", {
    label: "Picture adjustments",
    defaults: DEFAULT_VIDEO_APPEARANCE,
    getSnapshot: () => usePlaybackEnhancements.getState().picture,
    apply: (value) => usePlaybackEnhancements.setState({ picture: value }),
    subscribe: usePlaybackEnhancements.subscribe,
    validate: (value) => normalizeVideoAppearance(object(value)),
  });
  registerAppPreferenceSection("audioBoost", {
    label: "Per-title audio boost",
    defaults: {} as Record<string, number>,
    localFallback: currentAccountBoosts,
    getSnapshot: currentAccountBoosts,
    apply: applyAccountBoosts,
    subscribe: usePlaybackEnhancements.subscribe,
    validate: (value) => normalizeBoostByTitle(object(value)),
  });
  registerAppPreferenceSection("language", {
    label: "Interface language",
    defaults: {
      language: Object.hasOwn(locales, navigator.language)
        ? navigator.language
        : Object.hasOwn(locales, navigator.language.split("-")[0])
          ? navigator.language.split("-")[0]
          : "en",
    },
    getSnapshot: () => ({ language: useLanguageStore.getState().language }),
    apply: (value) => useLanguageStore.setState(value),
    subscribe: useLanguageStore.subscribe,
    validate: (value) => {
      const language = object(value).language;
      if (typeof language !== "string" || !Object.hasOwn(locales, language))
        throw new Error("Unsupported interface language.");
      return { language };
    },
  });
}
