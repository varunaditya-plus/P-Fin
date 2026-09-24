import { useEffect } from "react";

// Register lightweight settings before hydration, even when their feature pages
// are lazy-loaded or the user opens Settings directly after signing in.
import "@/components/player/subtitleTools/preferences";
import "@/pages/taste/viewPreferences";
import "@/stores/integrations/simkl";
import "@/stores/taste";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { registerBuiltinPreferences } from "./builtins";
import { startAccountPreferencesSync } from "./sync";

registerBuiltinPreferences();

export function AccountPreferencesSync() {
  const session = useJellyfinAuth((state) => state.session);
  useEffect(() => {
    if (!session) return;
    return startAccountPreferencesSync(session);
  }, [session]);
  return null;
}
