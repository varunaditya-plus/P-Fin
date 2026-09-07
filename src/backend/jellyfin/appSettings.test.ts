// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { JellyfinSession, useJellyfinAuth } from "@/stores/jellyfin";

import {
  APP_SETTINGS_KEY,
  getAppSettings,
  saveAppSettings,
} from "./appSettings";

vi.mock("@/backend/jellyfin/client", () => ({ jellyfinRequest: vi.fn() }));
const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  userId: "user",
  accessToken: "test",
  userName: "User",
  deviceId: "web",
};
describe("Jellyfin app preferences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useJellyfinAuth.setState({ session });
  });
  it("preserves unknown server fields, custom preferences and unregistered settings on save", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Id: "server-id",
        SortBy: "SortName",
        CustomPrefs: {
          untouched: "keep",
          [APP_SETTINGS_KEY]: JSON.stringify({
            version: 1,
            sections: { future: { keep: true }, themes: { old: true } },
          }),
        },
      })
      .mockResolvedValueOnce(undefined);
    await saveAppSettings({ themes: { new: true } }, session);
    const [path, init, query] = vi.mocked(jellyfinRequest).mock.calls[1];
    expect(path).toBe("DisplayPreferences/movie-fin");
    expect(query).toEqual({ userId: "user", client: "movie-fin" });
    const body = JSON.parse(init!.body as string);
    expect(body.SortBy).toBe("SortName");
    expect(body.CustomPrefs.untouched).toBe("keep");
    expect(JSON.parse(body.CustomPrefs[APP_SETTINGS_KEY]).sections).toEqual({
      future: { keep: true },
      themes: { new: true },
    });
  });
  it("never posts fetched settings after the Jellyfin account changes", async () => {
    vi.mocked(jellyfinRequest).mockImplementationOnce(async () => {
      useJellyfinAuth.setState({ session: { ...session, userId: "other" } });
      return { CustomPrefs: {} };
    });
    await expect(saveAppSettings({ themes: {} }, session)).rejects.toThrow(
      "account changed",
    );
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite malformed or newer server formats", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      CustomPrefs: {
        [APP_SETTINGS_KEY]: JSON.stringify({ version: 2, sections: {} }),
      },
    });
    await expect(getAppSettings(session)).rejects.toThrow("unsupported");
    await expect(saveAppSettings({ themes: {} }, session)).rejects.toThrow(
      "unsupported",
    );
    expect(
      vi.mocked(jellyfinRequest).mock.calls.every(([, init]) => !init?.method),
    ).toBe(true);
  });
});
