import { matchesSettingsSession } from "./appSettings";
import { JellyfinItem, getJellyfinSession, jellyfinRequest } from "./client";

/** Jellyfin 12 has no HideFromResume flag. Its user-data patch resets only the
 * selected item's resume point, leaving watched status, play count and history
 * unchanged. The UI explains this before submitting the reset.
 * See ItemsController.UpdateItemUserData and UpdateUserItemDataDto in Jellyfin.
 */
export async function resetResumePoint(itemId: string) {
  const session = getJellyfinSession();
  if (!itemId.trim()) throw new Error("Choose a library item to reset.");
  if (!matchesSettingsSession(session))
    throw new Error("Your Jellyfin account changed. Try again.");
  const user = await jellyfinRequest<{
    Policy?: {
      IsAdministrator?: boolean;
      EnableUserPreferenceAccess?: boolean;
    };
  }>(`Users/${encodeURIComponent(session.userId)}`);
  if (!matchesSettingsSession(session))
    throw new Error("Your Jellyfin account changed. Try again.");
  if (
    !user.Policy?.IsAdministrator &&
    user.Policy?.EnableUserPreferenceAccess === false
  )
    throw new Error(
      "Your Jellyfin account cannot change its playback preferences.",
    );
  const result = await jellyfinRequest<JellyfinItem["UserData"]>(
    `UserItems/${encodeURIComponent(itemId)}/UserData`,
    { method: "POST", body: JSON.stringify({ PlaybackPositionTicks: 0 }) },
    { userId: session.userId },
  );
  if (!matchesSettingsSession(session))
    throw new Error("Your Jellyfin account changed. Open the library again.");
  return result;
}
