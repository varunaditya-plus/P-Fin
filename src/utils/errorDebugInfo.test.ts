// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import { useJellyfinAuth } from "@/stores/jellyfin";

import {
  createErrorReport,
  errorMessage,
  gatherErrorDebugInfo,
  redactDiagnostics,
} from "./errorDebugInfo";

afterEach(() => {
  vi.restoreAllMocks();
  useJellyfinAuth.setState({ session: null });
});
describe("safe error reports", () => {
  it("preserves native and React stacks while removing HLS and URL credentials", () => {
    const error = Object.assign(new Error("Stream failed"), {
      hls: {
        type: "networkError",
        details: "fragLoadError",
        fatal: true,
        url: "https://host/stream?ApiKey=legacy-secret&token=modern-secret&level=2",
        frag: {
          url: "https://host/part?access_token=another-secret",
          baseurl: "https://name:private-password@host/path",
        },
      },
    });
    const report = createErrorReport(error, "at First\nat LastComponent");
    expect(report).toContain("Error: Stream failed");
    expect(report).toContain("at LastComponent");
    expect(report).toContain("fragLoadError");
    expect(report).toContain("level=2");
    for (const secret of [
      "legacy-secret",
      "modern-secret",
      "another-secret",
      "private-password",
    ])
      expect(report).not.toContain(secret);
    expect(gatherErrorDebugInfo(error).hls?.url).toContain("[redacted]");
  });
  it("removes unlabelled active credentials and common structured credentials", () => {
    useJellyfinAuth.setState({
      session: {
        serverUrl: "/jellyfin",
        accessToken: "active-secret",
        userId: "user",
        userName: "Name",
        deviceId: "device",
      },
    });
    const text = redactDiagnostics(
      'active-secret {"password":"p a s s", "Token":"other-secret"}\nAuthorization: MediaBrowser Token="header-secret"\nBearer bearer-secret',
    );
    for (const secret of [
      "active-secret",
      "p a s s",
      "other-secret",
      "header-secret",
      "bearer-secret",
    ])
      expect(text).not.toContain(secret);
  });
  it("keeps basic diagnostics available when browser metrics fail", () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    const report = createErrorReport(
      new Error("Original failure"),
      "Full component stack",
    );
    expect(report).toContain("Error: Original failure");
    expect(report).toContain("Full component stack");
    expect(report).toContain("Additional diagnostics are unavailable");
  });
  it("does not crash while formatting thrown values with hostile getters", () => {
    const cause = {
      get message() {
        throw new Error("Getter failed");
      },
      toString() {
        throw new Error("String failed");
      },
    };
    expect(errorMessage(cause)).toBe("Unknown error");
    expect(createErrorReport(cause)).toContain("Unknown error");
  });
});
