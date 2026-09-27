import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { locales } from "@/assets/languages";
import { getInterfaceName } from "@/setup/branding";
import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";

const resources = Object.fromEntries(
  Object.entries(locales).map((entry) => [entry[0], { translation: entry[1] }]),
);
i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources,
  react: { bindI18n: "languageChanged serverNameChanged" },
  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
    defaultVariables: { serverName: getInterfaceName() },
  },
});

function updateInterfaceName() {
  const interpolation = i18n.options.interpolation;
  const serverName = getInterfaceName();
  if (
    interpolation &&
    interpolation.defaultVariables?.serverName !== serverName
  ) {
    interpolation.defaultVariables = {
      ...interpolation.defaultVariables,
      serverName,
    };
    i18n.emit("serverNameChanged");
  }
}

const unsubscribeAuth = useJellyfinAuth.subscribe(updateInterfaceName);
const unsubscribeServers = useJellyfinServers.subscribe(updateInterfaceName);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unsubscribeAuth();
    unsubscribeServers();
  });

export default i18n;
