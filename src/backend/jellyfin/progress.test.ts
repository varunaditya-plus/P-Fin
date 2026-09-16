// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { resetResumePoint } from "./progress";

vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  jellyfinRequest: vi.fn(),
}));
const session = {
  serverUrl: "/jellyfin",
  userId: "current",
  userName: "User",
  accessToken: "test",
  deviceId: "web",
};
beforeEach(() => {
  vi.resetAllMocks();
  useJellyfinAuth.setState({ session });
});
describe("reset resume point", () => {
  it("updates only the resume position of the signed-in user and returns server user data", async () => {
    const updated = {
      PlaybackPositionTicks: 0,
      Played: false,
      IsFavorite: true,
      PlayCount: 3,
    };
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { EnableUserPreferenceAccess: true } })
      .mockResolvedValueOnce(updated);
    expect(await resetResumePoint("episode")).toEqual(updated);
    expect(vi.mocked(jellyfinRequest).mock.calls).toEqual([
      ["Users/current"],
      [
        "UserItems/episode/UserData",
        { method: "POST", body: '{"PlaybackPositionTicks":0}' },
        { userId: "current" },
      ],
    ]);
  });
  it("does not write when the user is denied preference access", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Policy: { EnableUserPreferenceAccess: false },
    });
    await expect(resetResumePoint("episode")).rejects.toThrow("cannot change");
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
  it("does not write after the account switches during the permission read", async () => {
    vi.mocked(jellyfinRequest).mockImplementation(async () => {
      useJellyfinAuth.setState({ session: { ...session, userId: "other" } });
      return { Policy: { EnableUserPreferenceAccess: true } };
    });
    await expect(resetResumePoint("episode")).rejects.toThrow(
      "account changed",
    );
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
  it("does not publish an old-account response after a successful write", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockImplementationOnce(async () => {
        useJellyfinAuth.setState({
          session: { ...session, serverUrl: "https://other.example" },
        });
        return { PlaybackPositionTicks: 0 };
      });
    await expect(resetResumePoint("episode")).rejects.toThrow(
      "account changed",
    );
  });
});
