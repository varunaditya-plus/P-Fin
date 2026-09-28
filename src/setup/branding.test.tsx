import { act } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { locales } from "@/assets/languages";
import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";

import { getInterfaceName } from "./branding";
import i18n from "./i18n";

const server = {
  id: "home",
  name: "Home Cinema",
  apiUrl: "/jellyfin",
  url: "https://jellyfin.example",
};
const session = {
  serverId: server.id,
  serverUrl: server.apiUrl,
  serverName: server.name,
  userId: "user",
  userName: "Viewer",
  accessToken: "test-token",
  deviceId: "test-device",
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function InterfaceText() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t("global.name")}</h1>
      <p>{t("global.pages.pagetitle", { title: "Settings" })}</p>
    </>
  );
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useJellyfinAuth.setState({ session: null });
  useJellyfinServers.setState({ servers: [], selectedServer: null });
  await i18n.changeLanguage("en");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useJellyfinAuth.setState({ session: null });
  useJellyfinServers.setState({ servers: [], selectedServer: null });
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("updates mounted interface text when selecting a server, signing in or changing servers", async () => {
  await act(async () => root.render(<InterfaceText />));
  expect(container.querySelector("h1")?.textContent).toBe("P-Fin");
  await act(async () => useJellyfinServers.getState().saveServer(server));
  expect(container.querySelector("h1")?.textContent).toBe(server.name);
  expect(container.querySelector("p")?.textContent).toBe(
    "Settings - Home Cinema",
  );
  await act(async () => useJellyfinAuth.getState().setSession(session));
  await act(async () =>
    useJellyfinServers.getState().saveServer({
      ...server,
      id: "other",
      apiUrl: "/other",
      name: "Other server",
    }),
  );
  expect(container.querySelector("h1")?.textContent).toBe(server.name);
  await act(async () => useJellyfinAuth.getState().setSession(null));
  expect(container.querySelector("h1")?.textContent).toBe("Other server");
  await act(async () => useJellyfinServers.getState().selectServer(null));
  expect(container.querySelector("h1")?.textContent).toBe("P-Fin");
});

it("uses the matching saved name for older sessions and never borrows another server's name", () => {
  useJellyfinServers.getState().saveServer(server);
  useJellyfinAuth.getState().setSession({ ...session, serverName: undefined });
  expect(getInterfaceName()).toBe(server.name);
  useJellyfinServers.getState().selectServer({
    ...server,
    id: "other",
    name: "Other server",
  });
  expect(getInterfaceName()).toBe("P-Fin");
});

it("uses the server name in every locale's brand and page title, including fallback translations", async () => {
  useJellyfinAuth.getState().setSession(session);
  for (const lng of Object.keys(locales)) {
    expect(i18n.t("global.name", { lng }), lng).toBe(server.name);
    expect(
      i18n.t("global.pages.pagetitle", { lng, title: "Settings" }),
      lng,
    ).toContain(server.name);
  }
  await act(async () => root.render(<InterfaceText />));
  await act(async () => i18n.changeLanguage("he"));
  expect(container.querySelector("h1")?.textContent).toBe(server.name);
  expect(container.querySelector("p")?.textContent).toBe(
    "Settings – Home Cinema",
  );
});

it("renders server names as literal text and falls back for empty names", async () => {
  const name = "<img src=x> & {{title}}";
  useJellyfinAuth.getState().setSession({ ...session, serverName: name });
  await act(async () => root.render(<InterfaceText />));
  expect(container.querySelector("h1")?.textContent).toBe(name);
  expect(container.querySelector("p")?.textContent).toBe(`Settings - ${name}`);
  expect(container.querySelector("img")).toBeNull();
  await act(async () =>
    useJellyfinAuth.getState().setSession({ ...session, serverName: "  " }),
  );
  expect(container.querySelector("h1")?.textContent).toBe("P-Fin");
});
