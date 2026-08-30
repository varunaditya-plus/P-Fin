import { iso6393To1, iso6393To2B } from "iso-639-3";

import { getJellyfinSession, jellyfinRequest } from "@/backend/jellyfin/client";

export type SubtitleMode =
  | "Default"
  | "Smart"
  | "OnlyForced"
  | "Always"
  | "None";

export interface JellyfinUserConfiguration {
  AudioLanguagePreference?: string | null;
  PlayDefaultAudioTrack?: boolean;
  SubtitleLanguagePreference?: string | null;
  SubtitleMode?: SubtitleMode;
  RememberAudioSelections?: boolean;
  RememberSubtitleSelections?: boolean;
  EnableNextEpisodeAutoPlay?: boolean;
  [key: string]: unknown;
}

export interface JellyfinCulture {
  Name: string;
  DisplayName: string;
  ThreeLetterISOLanguageName?: string | null;
}

export interface PreferredTrackStream {
  Index: number;
  Type: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsOriginal?: boolean;
  IsExternal?: boolean;
}

export interface PreferredTrackSource {
  MediaStreams?: PreferredTrackStream[];
  DefaultAudioStreamIndex?: number | null;
  DefaultSubtitleStreamIndex?: number | null;
}

export interface RememberedTrackSelection {
  audioLanguage?: string;
  audioCodec?: string;
  subtitleLanguage?: string;
  subtitleCodec?: string;
  subtitleForced?: boolean;
  subtitleOff: boolean;
}

export interface PreferredPlaybackOptions {
  audioIndex?: number;
  subtitleIndex: number;
}

export async function getUserConfiguration(signal?: AbortSignal) {
  const user = await jellyfinRequest<{
    Configuration?: JellyfinUserConfiguration;
  }>(`Users/${getJellyfinSession().userId}`, { signal });
  return user.Configuration ?? {};
}

export async function updateUserConfiguration(
  patch: Partial<JellyfinUserConfiguration>,
) {
  const session = getJellyfinSession();
  // Jellyfin replaces the complete configuration. Fetch it again so settings
  // maintained by Jellyfin Web and other clients are preserved.
  const current = await getUserConfiguration();
  const stillCurrent = getJellyfinSession();
  if (
    stillCurrent.userId !== session.userId ||
    stillCurrent.accessToken !== session.accessToken ||
    stillCurrent.serverUrl !== session.serverUrl
  )
    throw new Error(
      "Your Jellyfin account changed. Reload settings and retry.",
    );
  if (
    Object.entries(patch).every(([key, value]) =>
      Object.is(current[key], value),
    )
  )
    return current;
  const updated = { ...current, ...patch };
  await jellyfinRequest<void>(
    "Users/Configuration",
    { method: "POST", body: JSON.stringify(updated) },
    { userId: session.userId },
  );
  return updated;
}

export function getCultures(signal?: AbortSignal) {
  return jellyfinRequest<JellyfinCulture[]>("Localization/Cultures", {
    signal,
  });
}

const bibliographicLanguages = Object.fromEntries(
  Object.entries(iso6393To2B).map(([canonical, alias]) => [
    alias,
    iso6393To1[canonical] ?? canonical,
  ]),
);

function language(value?: string | null) {
  const normalized = value?.trim().toLowerCase().split(/[-_]/)[0];
  if (!normalized || normalized === "originallanguage") return "";
  return (
    iso6393To1[normalized] ?? bibliographicLanguages[normalized] ?? normalized
  );
}

function bestLanguageMatch(
  streams: PreferredTrackStream[],
  preferred?: string | null,
  codec?: string,
) {
  const wanted = language(preferred);
  if (!wanted) return undefined;
  const matching = streams.filter(
    (stream) => language(stream.Language) === wanted,
  );
  return (
    (codec ? matching.find((stream) => stream.Codec === codec) : undefined) ??
    matching.find((stream) => stream.IsDefault) ??
    matching[0]
  );
}

function byIndex(streams: PreferredTrackStream[], index?: number | null) {
  return streams.find((stream) => stream.Index === index);
}

function hasUndefinedLanguage(stream: PreferredTrackStream) {
  return ["", "und", "unknown", "undetermined", "mul", "zxx"].includes(
    language(stream.Language),
  );
}

/** Preserve Jellyfin's user-specific defaults; apply session choices and fallback rules. */
export function getPreferredPlaybackOptions(
  source: PreferredTrackSource,
  configuration: JellyfinUserConfiguration,
  previous?: RememberedTrackSelection | null,
  originalLanguage?: string | null,
): PreferredPlaybackOptions {
  const audio = (source.MediaStreams ?? []).filter(
    (stream) => stream.Type === "Audio",
  );
  const subtitles = (source.MediaStreams ?? []).filter(
    (stream) => stream.Type === "Subtitle",
  );
  const rememberedAudio =
    configuration.RememberAudioSelections && previous?.audioLanguage
      ? bestLanguageMatch(audio, previous.audioLanguage, previous.audioCodec)
      : undefined;
  const preferOriginal =
    configuration.AudioLanguagePreference?.toLowerCase() === "originallanguage";
  const audioLanguage = preferOriginal
    ? originalLanguage
    : configuration.AudioLanguagePreference;
  const originalAudio = preferOriginal
    ? audio.find(
        (stream) =>
          stream.IsOriginal &&
          (!language(originalLanguage) ||
            language(stream.Language) === language(originalLanguage)),
      )
    : undefined;
  const preferredAudio = bestLanguageMatch(audio, audioLanguage);
  const defaultAudio =
    bestLanguageMatch(
      audio.filter((stream) => stream.IsDefault),
      audioLanguage,
    ) ?? audio.find((stream) => stream.IsDefault);
  const selectedAudio =
    rememberedAudio ??
    // Jellyfin computes this using item history and inherited original language.
    byIndex(audio, source.DefaultAudioStreamIndex) ??
    (configuration.PlayDefaultAudioTrack !== false
      ? defaultAudio
      : originalAudio) ??
    preferredAudio ??
    defaultAudio ??
    audio[0];

  const mode = configuration.SubtitleMode ?? "Default";
  if (mode === "None")
    return { audioIndex: selectedAudio?.Index, subtitleIndex: -1 };

  if (configuration.RememberSubtitleSelections && previous) {
    if (previous.subtitleOff)
      return { audioIndex: selectedAudio?.Index, subtitleIndex: -1 };
    const rememberedSubtitle = bestLanguageMatch(
      subtitles.filter(
        (stream) =>
          (mode !== "OnlyForced" || stream.IsForced) &&
          (previous.subtitleForced === undefined ||
            Boolean(stream.IsForced) === previous.subtitleForced),
      ),
      previous.subtitleLanguage,
      previous.subtitleCodec,
    );
    if (rememberedSubtitle)
      return {
        audioIndex: selectedAudio?.Index,
        subtitleIndex: rememberedSubtitle.Index,
      };
  }

  // Smart defaults depend on the audio language, so recalculate after a remembered audio change.
  if (
    mode !== "Smart" ||
    selectedAudio?.Index === source.DefaultAudioStreamIndex
  ) {
    const defaultSubtitle = byIndex(
      subtitles,
      source.DefaultSubtitleStreamIndex,
    );
    if (
      source.DefaultSubtitleStreamIndex === -1 ||
      source.DefaultSubtitleStreamIndex === null
    )
      return { audioIndex: selectedAudio?.Index, subtitleIndex: -1 };
    if (defaultSubtitle && (mode !== "OnlyForced" || defaultSubtitle.IsForced))
      return {
        audioIndex: selectedAudio?.Index,
        subtitleIndex: defaultSubtitle.Index,
      };
  }

  const wanted = language(configuration.SubtitleLanguagePreference);
  const matchesLanguage = (stream: PreferredTrackStream) =>
    !wanted || language(stream.Language) === wanted;
  // Match the ordering used by Jellyfin's MediaStreamSelector.
  const score = (stream: PreferredTrackStream) =>
    Number(Boolean(stream.IsExternal)) * 32 +
    Number(Boolean(stream.IsDefault)) * 16 +
    Number(!stream.IsForced && matchesLanguage(stream)) * 8 +
    Number(Boolean(stream.IsForced) && matchesLanguage(stream)) * 4 +
    Number(Boolean(stream.IsForced) && hasUndefinedLanguage(stream)) * 2 +
    Number(Boolean(stream.IsForced));
  const sortedSubtitles = [...subtitles].sort(
    (left, right) => score(right) - score(left),
  );
  const forcedSubtitle = sortedSubtitles
    .filter(
      (stream) =>
        stream.IsForced &&
        (matchesLanguage(stream) || hasUndefinedLanguage(stream)),
    )
    .sort(
      (left, right) =>
        Number(matchesLanguage(right)) - Number(matchesLanguage(left)),
    )[0];
  let selectedSubtitle: PreferredTrackStream | undefined;
  if (mode === "OnlyForced") {
    selectedSubtitle = forcedSubtitle;
  } else if (mode === "Always") {
    selectedSubtitle =
      sortedSubtitles.find(
        (stream) => !stream.IsForced && matchesLanguage(stream),
      ) ?? forcedSubtitle;
  } else if (mode === "Smart") {
    const spoken = language(selectedAudio?.Language);
    selectedSubtitle =
      wanted && wanted === spoken
        ? forcedSubtitle
        : sortedSubtitles.find(matchesLanguage);
  } else if (mode === "Default") {
    selectedSubtitle = sortedSubtitles.find(
      (stream) => stream.IsExternal || stream.IsDefault || stream.IsForced,
    );
  }
  return {
    audioIndex: selectedAudio?.Index,
    subtitleIndex: selectedSubtitle?.Index ?? -1,
  };
}

/** Capture a manual choice by language so it can follow the next episode. */
export function rememberTrackSelection(
  source: PreferredTrackSource,
  audioIndex?: number,
  subtitleIndex = -1,
): RememberedTrackSelection {
  const audio = source.MediaStreams?.find(
    (stream) => stream.Type === "Audio" && stream.Index === audioIndex,
  );
  const subtitle = source.MediaStreams?.find(
    (stream) => stream.Type === "Subtitle" && stream.Index === subtitleIndex,
  );
  return {
    audioLanguage: audio?.Language,
    audioCodec: audio?.Codec,
    subtitleLanguage: subtitle?.Language,
    subtitleCodec: subtitle?.Codec,
    subtitleForced: subtitle ? Boolean(subtitle.IsForced) : undefined,
    subtitleOff: subtitleIndex < 0,
  };
}
