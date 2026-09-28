// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { JellyfinSession } from "@/stores/jellyfin";

import { homePreferenceScope } from "./home";

describe("home preferences", () => {
  it("keeps layout private to each user and server but stable across login tokens", () => {
    const session = {
      serverId: "server-a",
      serverUrl: "/jellyfin",
      userId: "user-a",
      accessToken: "first",
    } as JellyfinSession;
    expect(homePreferenceScope(session)).toBe(
      homePreferenceScope({ ...session, accessToken: "second" }),
    );
    expect(homePreferenceScope(session)).not.toBe(
      homePreferenceScope({ ...session, userId: "user-b" }),
    );
    expect(homePreferenceScope(session)).not.toBe(
      homePreferenceScope({ ...session, serverId: "server-b" }),
    );
  });
});
