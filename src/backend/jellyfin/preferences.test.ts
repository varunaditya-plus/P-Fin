// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getJellyfinSession, jellyfinRequest } from "@/backend/jellyfin/client";

import {
  getPreferredPlaybackOptions,
  rememberTrackSelection,
  updateUserConfiguration,
} from "./preferences";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: vi.fn(),
  jellyfinRequest: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(jellyfinRequest).mockReset();
  vi.mocked(getJellyfinSession).mockReset().mockReturnValue({
    userId: "user-1",
    accessToken: "test-token",
    serverUrl: "/jellyfin",
    userName: "User",
    deviceId: "device",
  });
});

const source = {
  MediaStreams: [
    { Index: 1, Type: "Audio", Language: "eng", Codec: "aac" },
    { Index: 2, Type: "Audio", Language: "jpn", Codec: "aac" },
    { Index: 3, Type: "Subtitle", Language: "eng", Codec: "subrip" },
    {
      Index: 4,
      Type: "Subtitle",
      Language: "eng",
      Codec: "subrip",
      IsForced: true,
    },
  ],
};

describe("server-backed playback preferences", () => {
  it("merges a change into the full fresh user configuration", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Configuration: {
          AudioLanguagePreference: "eng",
          HidePlayedInLatest: true,
          OrderedViews: ["library-1"],
        },
      })
      .mockResolvedValueOnce(undefined);
    await updateUserConfiguration({ SubtitleMode: "OnlyForced" });
    const [path, init, query] = vi.mocked(jellyfinRequest).mock.calls[1];
    expect(path).toBe("Users/Configuration");
    expect(query).toEqual({ userId: "user-1" });
    expect(JSON.parse(String(init?.body))).toEqual({
      AudioLanguagePreference: "eng",
      HidePlayedInLatest: true,
      OrderedViews: ["library-1"],
      SubtitleMode: "OnlyForced",
    });
  });

  it("does not POST when the requested setting already matches the server", async () => {
    const completeConfiguration = {
      SubtitleMode: "Smart",
      HidePlayedInLatest: true,
      GroupedFolders: ["library-1"],
    };
    vi.mocked(jellyfinRequest).mockResolvedValueOnce({
      Configuration: completeConfiguration,
    });
    await expect(
      updateUserConfiguration({ SubtitleMode: "Smart" }),
    ).resolves.toEqual(completeConfiguration);
    expect(vi.mocked(jellyfinRequest)).toHaveBeenCalledTimes(1);
  });

  it("does not save settings to a different server after the configuration fetch", async () => {
    const session = getJellyfinSession();
    vi.mocked(jellyfinRequest).mockImplementationOnce(async () => {
      vi.mocked(getJellyfinSession).mockReturnValue({
        ...session,
        serverUrl: "https://other.example",
      });
      return { Configuration: {} };
    });
    await expect(
      updateUserConfiguration({ SubtitleMode: "OnlyForced" }),
    ).rejects.toThrow("account changed");
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });

  it("uses the preferred audio language when default-track priority is off", () => {
    expect(
      getPreferredPlaybackOptions(source, {
        AudioLanguagePreference: "jpn",
        PlayDefaultAudioTrack: false,
        SubtitleMode: "None",
      }),
    ).toEqual({ audioIndex: 2, subtitleIndex: -1 });
  });

  it("supports forced-only and smart subtitle modes", () => {
    expect(
      getPreferredPlaybackOptions(source, {
        SubtitleLanguagePreference: "eng",
        SubtitleMode: "OnlyForced",
      }).subtitleIndex,
    ).toBe(4);
    expect(
      getPreferredPlaybackOptions(source, {
        SubtitleLanguagePreference: "eng",
        SubtitleMode: "Smart",
      }).subtitleIndex,
    ).toBe(4);
    expect(
      getPreferredPlaybackOptions(source, {
        AudioLanguagePreference: "jpn",
        PlayDefaultAudioTrack: false,
        SubtitleLanguagePreference: "eng",
        SubtitleMode: "Smart",
      }).subtitleIndex,
    ).toBe(3);
    expect(
      getPreferredPlaybackOptions(source, {
        AudioLanguagePreference: "jpn",
        PlayDefaultAudioTrack: false,
        SubtitleLanguagePreference: "spa",
        SubtitleMode: "Smart",
      }).subtitleIndex,
    ).toBe(-1);
  });

  it("retains user-specific server defaults, including original audio and subtitles switched off", () => {
    const itemSource = {
      ...source,
      DefaultAudioStreamIndex: 2,
      DefaultSubtitleStreamIndex: 3,
    };
    expect(
      getPreferredPlaybackOptions(itemSource, {
        AudioLanguagePreference: "OriginalLanguage",
        SubtitleMode: "Smart",
      }),
    ).toEqual({ audioIndex: 2, subtitleIndex: 3 });
    for (const off of [-1, null]) {
      for (const mode of [
        "Default",
        "Smart",
        "Always",
        "OnlyForced",
      ] as const) {
        expect(
          getPreferredPlaybackOptions(
            { ...itemSource, DefaultSubtitleStreamIndex: off },
            {
              SubtitleMode: mode,
            },
          ).subtitleIndex,
        ).toBe(-1);
      }
    }
  });

  it("falls back to original-language metadata and flags without confusing stream indices with array positions", () => {
    const original = {
      MediaStreams: [
        { Index: 4, Type: "Audio", Language: "eng", IsDefault: true },
        { Index: 7, Type: "Audio", Language: "jpn", IsOriginal: true },
        { Index: 9, Type: "Audio", Language: "fra" },
      ],
    };
    const options = {
      AudioLanguagePreference: "OriginalLanguage",
      PlayDefaultAudioTrack: false,
    };
    expect(getPreferredPlaybackOptions(original, options).audioIndex).toBe(7);
    expect(
      getPreferredPlaybackOptions(original, options, undefined, "ja")
        .audioIndex,
    ).toBe(7);
    expect(
      getPreferredPlaybackOptions(original, options, undefined, "fre")
        .audioIndex,
    ).toBe(9);
    expect(
      getPreferredPlaybackOptions(
        original,
        { ...options, PlayDefaultAudioTrack: true },
        undefined,
        "ja",
      ).audioIndex,
    ).toBe(4);
  });

  it("uses preferred subtitles for unknown audio, and wildcard language selection when no preference is set", () => {
    const unknownAudio = {
      MediaStreams: [
        { Index: 1, Type: "Audio" },
        { Index: 2, Type: "Subtitle", Language: "fra" },
        { Index: 3, Type: "Subtitle", Language: "eng" },
      ],
    };
    expect(
      getPreferredPlaybackOptions(unknownAudio, {
        SubtitleMode: "Smart",
        SubtitleLanguagePreference: "eng",
      }).subtitleIndex,
    ).toBe(3);
    expect(
      getPreferredPlaybackOptions(unknownAudio, { SubtitleMode: "Smart" })
        .subtitleIndex,
    ).toBe(2);
  });

  it("only selects forced subtitles in the preferred or an unspecified language", () => {
    const forced = {
      MediaStreams: [
        { Index: 1, Type: "Subtitle", Language: "fra", IsForced: true },
        {
          Index: 2,
          Type: "Subtitle",
          Language: "und",
          IsForced: true,
          IsExternal: true,
        },
        { Index: 3, Type: "Subtitle", Language: "eng", IsForced: true },
      ],
    };
    expect(
      getPreferredPlaybackOptions(forced, {
        SubtitleMode: "OnlyForced",
        SubtitleLanguagePreference: "eng",
      }).subtitleIndex,
    ).toBe(3);
    expect(
      getPreferredPlaybackOptions(forced, {
        SubtitleMode: "OnlyForced",
        SubtitleLanguagePreference: "spa",
      }).subtitleIndex,
    ).toBe(2);
    expect(
      getPreferredPlaybackOptions(
        { MediaStreams: [forced.MediaStreams[0]] },
        {
          SubtitleMode: "OnlyForced",
          SubtitleLanguagePreference: "eng",
        },
      ).subtitleIndex,
    ).toBe(-1);
  });

  it("Always prefers a full matching track then forced subtitles instead of an unrelated full track", () => {
    const available = {
      MediaStreams: [
        {
          Index: 1,
          Type: "Subtitle",
          Language: "eng",
          IsForced: true,
          IsDefault: true,
        },
        { Index: 2, Type: "Subtitle", Language: "eng" },
        { Index: 3, Type: "Subtitle", Language: "fra" },
        { Index: 4, Type: "Subtitle", Language: "und", IsForced: true },
      ],
    };
    expect(
      getPreferredPlaybackOptions(available, {
        SubtitleMode: "Always",
        SubtitleLanguagePreference: "eng",
      }).subtitleIndex,
    ).toBe(2);
    expect(
      getPreferredPlaybackOptions(available, {
        SubtitleMode: "Always",
        SubtitleLanguagePreference: "spa",
      }).subtitleIndex,
    ).toBe(4);
  });

  it("Default uses external, default and forced flags with Jellyfin's ordering", () => {
    expect(
      getPreferredPlaybackOptions(
        {
          MediaStreams: [
            { Index: 1, Type: "Subtitle", Language: "eng", IsDefault: true },
            { Index: 2, Type: "Subtitle", Language: "eng", IsExternal: true },
          ],
        },
        { SubtitleMode: "Default" },
      ).subtitleIndex,
    ).toBe(2);
    expect(
      getPreferredPlaybackOptions(
        { MediaStreams: [{ Index: 1, Type: "Subtitle", Language: "eng" }] },
        { SubtitleMode: "Default" },
      ).subtitleIndex,
    ).toBe(-1);
  });

  it("does not resurrect remembered full subtitles under None or OnlyForced", () => {
    const remembered = rememberTrackSelection(source, 1, 3);
    expect(
      getPreferredPlaybackOptions(
        source,
        {
          RememberSubtitleSelections: true,
          SubtitleMode: "None",
        },
        remembered,
      ).subtitleIndex,
    ).toBe(-1);
    expect(
      getPreferredPlaybackOptions(
        source,
        {
          RememberSubtitleSelections: true,
          SubtitleMode: "OnlyForced",
          SubtitleLanguagePreference: "eng",
        },
        remembered,
      ).subtitleIndex,
    ).toBe(4);
  });

  it("remembers whether a matching subtitle track was forced or full", () => {
    const remembered = rememberTrackSelection(source, 1, 4);
    expect(
      getPreferredPlaybackOptions(
        source,
        {
          RememberSubtitleSelections: true,
          SubtitleMode: "Always",
        },
        remembered,
      ).subtitleIndex,
    ).toBe(4);
  });

  it("recalculates Smart subtitles after remembered audio changes the spoken language", () => {
    const initial = {
      ...source,
      DefaultAudioStreamIndex: 1,
      DefaultSubtitleStreamIndex: 4,
    };
    const previous = rememberTrackSelection(source, 2, -1);
    expect(
      getPreferredPlaybackOptions(
        initial,
        {
          RememberAudioSelections: true,
          SubtitleMode: "Smart",
          SubtitleLanguagePreference: "eng",
        },
        previous,
      ),
    ).toEqual({ audioIndex: 2, subtitleIndex: 3 });
  });

  it("remembers manual language and Off choices for the next episode", () => {
    const previous = rememberTrackSelection(source, 2, 3);
    const next = {
      DefaultAudioStreamIndex: 6,
      DefaultSubtitleStreamIndex: -1,
      MediaStreams: [
        { Index: 6, Type: "Audio", Language: "eng", Codec: "aac" },
        { Index: 7, Type: "Audio", Language: "jpn", Codec: "aac" },
        { Index: 8, Type: "Subtitle", Language: "eng", Codec: "subrip" },
      ],
    };
    expect(
      getPreferredPlaybackOptions(
        next,
        { RememberAudioSelections: true, RememberSubtitleSelections: true },
        previous,
      ),
    ).toEqual({ audioIndex: 7, subtitleIndex: 8 });
    expect(
      getPreferredPlaybackOptions(
        next,
        { RememberSubtitleSelections: true, SubtitleMode: "Always" },
        rememberTrackSelection(source, 1, -1),
      ).subtitleIndex,
    ).toBe(-1);
  });
});
