import { jellyfinRequest } from "@/backend/jellyfin/client";
import { JellyfinSession, useJellyfinAuth } from "@/stores/jellyfin";

export const APP_SETTINGS_KEY = "movie-fin.settings.v1";
export type AppSettingsSections = Record<string, unknown>;
interface DisplayPreferences {
  CustomPrefs?: Record<string, string>;
  [key: string]: unknown;
}
export function matchesSettingsSession(session: JellyfinSession) {
  const current = useJellyfinAuth.getState().session;
  return (
    current?.serverUrl === session.serverUrl &&
    current?.userId === session.userId &&
    current?.accessToken === session.accessToken
  );
}
function assertSession(session: JellyfinSession) {
  if (!matchesSettingsSession(session))
    throw new Error("The Jellyfin account changed. Please try again.");
}
function readSections(display: DisplayPreferences): AppSettingsSections {
  const raw = display.CustomPrefs?.[APP_SETTINGS_KEY];
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    !value.sections ||
    typeof value.sections !== "object" ||
    Array.isArray(value.sections)
  )
    throw new Error(
      "Jellyfin contains an unsupported settings format. Your local settings are still available.",
    );
  return value.sections;
}
async function readDisplay(session: JellyfinSession, signal?: AbortSignal) {
  assertSession(session);
  const display = await jellyfinRequest<DisplayPreferences>(
    "DisplayPreferences/movie-fin",
    { signal },
    { userId: session.userId, client: "movie-fin" },
  );
  assertSession(session);
  return display;
}
export async function getAppSettings(
  session: JellyfinSession,
  signal?: AbortSignal,
) {
  return readSections(await readDisplay(session, signal));
}
/** Read immediately before each write to retain Jellyfin fields and unregistered sections. */
export async function saveAppSettings(
  sections: AppSettingsSections,
  session: JellyfinSession,
  signal?: AbortSignal,
) {
  const display = await readDisplay(session, signal);
  const merged = { ...readSections(display), ...sections };
  assertSession(session);
  await jellyfinRequest<void>(
    "DisplayPreferences/movie-fin",
    {
      method: "POST",
      signal,
      body: JSON.stringify({
        ...display,
        CustomPrefs: {
          ...display.CustomPrefs,
          [APP_SETTINGS_KEY]: JSON.stringify({ version: 1, sections: merged }),
        },
      }),
    },
    { userId: session.userId, client: "movie-fin" },
  );
  assertSession(session);
  return merged;
}
