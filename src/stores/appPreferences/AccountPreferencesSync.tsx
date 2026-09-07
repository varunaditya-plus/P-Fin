import { useEffect } from "react";

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
