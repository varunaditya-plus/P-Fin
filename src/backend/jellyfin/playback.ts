import { iso6393To1 } from "iso-639-3";

import {
  getJellyfinSession,
  jellyfinRequest,
  jellyfinUrl,
} from "@/backend/jellyfin/client";
import { JellyfinSession } from "@/stores/jellyfin";
import { CaptionListItem } from "@/stores/player/slices/source";
import { SourceSliceSource } from "@/stores/player/utils/qualities";

export interface JellyfinMediaStream {
  Index: number;
  Type: string;
  Codec?: string;
  DisplayTitle?: string;
  Title?: string;
  Language?: string;
  IsTextSubtitleStream?: boolean;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsOriginal?: boolean;
  IsHearingImpaired?: boolean;
  Height?: number;
}

export interface JellyfinMediaSource {
  Id: string;
  Container?: string;
  MediaStreams?: JellyfinMediaStream[];
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  TranscodingUrl?: string;
  DirectStreamUrl?: string;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
}

export interface JellyfinPlayback {
  owner?: JellyfinSession;
  itemId: string;
  playSessionId: string;
  mediaSource: JellyfinMediaSource;
  source: SourceSliceSource;
  captions: CaptionListItem[];
  audioIndex?: number;
  subtitleIndex: number;
  playMethod: "DirectPlay" | "DirectStream" | "Transcode";
}

function isCurrentSession(owner?: JellyfinSession) {
  if (!owner) return true;
  try {
    const current = getJellyfinSession();
    return (
      current.serverUrl === owner.serverUrl &&
      current.userId === owner.userId &&
      current.accessToken === owner.accessToken &&
      current.deviceId === owner.deviceId
    );
  } catch {
    return false;
  }
}

export interface PlaybackOptions {
  mediaSourceId?: string;
  audioIndex?: number;
  defaultAudioIndex?: number;
  subtitleIndex?: number;
  forceTranscode?: boolean;
  maxBitrate?: number;
}

function browserProfile(maxBitrate: number, forceCompatible: boolean) {
  const video = document.createElement("video");
  const hevcType = 'video/mp4; codecs="hvc1.1.6.L93.B0"';
  const hevc =
    !forceCompatible &&
    video.canPlayType(hevcType) &&
    (typeof MediaSource === "undefined" ||
      MediaSource.isTypeSupported(hevcType));
  const videoCodecs = hevc ? "h264,hevc" : "h264";
  return {
    Name: "P-Stream Web",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    DirectPlayProfiles: [
      {
        Container: "mp4,m4v",
        Type: "Video",
        VideoCodec: videoCodecs,
        AudioCodec: "aac,mp3",
      },
      {
        Container: "webm",
        Type: "Video",
        VideoCodec: "vp8,vp9,av1",
        AudioCodec: "vorbis,opus",
      },
    ],
    TranscodingProfiles: [
      {
        Container: "mp4",
        Type: "Video",
        VideoCodec: hevc ? "hevc,h264" : "h264",
        AudioCodec: "aac",
        Protocol: "hls",
        Context: "Streaming",
        MaxAudioChannels: "2",
        MinSegments: 1,
        BreakOnNonKeyFrames: false,
      },
    ],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [
          {
            Condition: "LessThanEqual",
            Property: "VideoBitDepth",
            Value: "8",
            IsRequired: false,
          },
        ],
      },
    ],
    SubtitleProfiles: [
      ...["vtt", "srt", "subrip", "ass", "ssa"].map((Format) => ({
        Format,
        Method: "External",
      })),
      ...["pgssub", "dvdsub", "dvbsub"].map((Format) => ({
        Format,
        Method: "Encode",
      })),
    ],
  };
}

/** Keep streams on the configured Jellyfin origin, with the current user's token. */
export function authenticatedStreamUrl(path: string): string {
  const session = getJellyfinSession();
  if (!session) throw new Error("Sign in to Jellyfin to play this title.");
  const parsed = new URL(path, window.location.origin);
  for (const key of [...parsed.searchParams.keys()]) {
    if (["apikey", "api_key", "token"].includes(key.toLowerCase()))
      parsed.searchParams.delete(key);
  }
  const query = Object.fromEntries(parsed.searchParams.entries());
  const serverBasePath = new URL(
    session.serverAddress ?? session.serverUrl,
    window.location.origin,
  ).pathname.replace(/\/$/, "");
  const streamPath =
    serverBasePath && parsed.pathname.startsWith(`${serverBasePath}/`)
      ? parsed.pathname.slice(serverBasePath.length)
      : parsed.pathname;
  return jellyfinUrl(streamPath, {
    ...query,
    ApiKey: session.accessToken,
  });
}

/** Limit software conversion without reducing compatible direct/remux streams. */
export function getTranscodingUrl(
  mediaSource: JellyfinMediaSource,
  options: PlaybackOptions,
): string {
  const url = new URL(authenticatedStreamUrl(mediaSource.TranscodingUrl!));
  const videoCodec = mediaSource.MediaStreams?.find(
    (stream) => stream.Type === "Video",
  )?.Codec?.toLowerCase();
  const acceptedCodecs = (url.searchParams.get("VideoCodec") ?? "")
    .toLowerCase()
    .split(",");
  const needsVideoEncode =
    options.forceTranscode ||
    (options.subtitleIndex ?? -1) >= 0 ||
    !videoCodec ||
    !acceptedCodecs.includes(videoCodec);
  if (needsVideoEncode) {
    const lowBitrate = (options.maxBitrate ?? 120_000_000) <= 2_000_000;
    url.searchParams.set("MaxWidth", String(lowBitrate ? 1280 : 1920));
    url.searchParams.set("MaxHeight", String(lowBitrate ? 720 : 1080));
    const bitrate = Math.min(options.maxBitrate ?? 20_000_000, 20_000_000);
    url.searchParams.set(
      "VideoBitrate",
      String(
        Math.min(
          Number(url.searchParams.get("VideoBitrate")) || bitrate,
          bitrate,
        ),
      ),
    );
  }
  return url.toString();
}

export async function getPlayback(
  itemId: string,
  options: PlaybackOptions = {},
): Promise<JellyfinPlayback> {
  const session = getJellyfinSession();
  if (!session) throw new Error("Sign in to Jellyfin to play this title.");
  const subtitleIndex = options.subtitleIndex ?? -1;
  const maxBitrate = options.maxBitrate ?? 120_000_000;
  const response = await jellyfinRequest<{
    ErrorCode?: string;
    PlaySessionId: string;
    MediaSources?: JellyfinMediaSource[];
  }>(`/Items/${itemId}/PlaybackInfo`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      UserId: session.userId,
      MediaSourceId: options.mediaSourceId,
      AudioStreamIndex: options.audioIndex,
      SubtitleStreamIndex: subtitleIndex,
      StartTimeTicks: 0,
      IsPlayback: true,
      EnableDirectPlay:
        !options.forceTranscode &&
        (options.audioIndex === undefined ||
          options.audioIndex === options.defaultAudioIndex) &&
        subtitleIndex < 0,
      EnableDirectStream: !options.forceTranscode,
      EnableTranscoding: true,
      AllowVideoStreamCopy: !options.forceTranscode,
      AllowAudioStreamCopy: !options.forceTranscode,
      MaxStreamingBitrate: maxBitrate,
      DeviceProfile: browserProfile(maxBitrate, !!options.forceTranscode),
    }),
  });
  if (!isCurrentSession(session))
    throw new Error(
      "Your Jellyfin account or server changed. Open this title from the current library.",
    );
  if (response.ErrorCode)
    throw new Error(`Jellyfin cannot play this title (${response.ErrorCode}).`);
  const mediaSource =
    response.MediaSources?.find(
      (source) => source.Id === options.mediaSourceId,
    ) ?? response.MediaSources?.[0];
  if (!mediaSource)
    throw new Error("Jellyfin has no playable media source for this title.");
  let source: SourceSliceSource;
  let playMethod: JellyfinPlayback["playMethod"];
  if (mediaSource.SupportsDirectPlay && !options.forceTranscode) {
    const url = jellyfinUrl(
      `/Videos/${itemId}/stream.${mediaSource.Container ?? "mp4"}`,
      {
        Static: true,
        MediaSourceId: mediaSource.Id,
        DeviceId: session.deviceId,
        PlaySessionId: response.PlaySessionId,
        ApiKey: session.accessToken,
      },
    );
    source = { type: "file", qualities: { unknown: { type: "mp4", url } } };
    playMethod = "DirectPlay";
  } else if (mediaSource.TranscodingUrl) {
    source = {
      type: "hls",
      url: getTranscodingUrl(mediaSource, options),
    };
    playMethod = mediaSource.SupportsDirectStream
      ? "DirectStream"
      : "Transcode";
  } else if (mediaSource.DirectStreamUrl && !options.forceTranscode) {
    const url = authenticatedStreamUrl(mediaSource.DirectStreamUrl);
    source = { type: "file", qualities: { unknown: { type: "mp4", url } } };
    playMethod = "DirectStream";
  } else
    throw new Error(
      "This file needs transcoding, which Jellyfin has not made available to your account.",
    );

  const captions = (mediaSource.MediaStreams ?? [])
    .filter(
      (stream) => stream.Type === "Subtitle" && stream.IsTextSubtitleStream,
    )
    .map(
      (stream): CaptionListItem => ({
        id: `jellyfin-${stream.Index}`,
        language: iso6393To1[stream.Language ?? ""] ?? stream.Language ?? "und",
        display:
          stream.DisplayTitle ?? stream.Title ?? stream.Language ?? "Subtitle",
        url: jellyfinUrl(
          `/Videos/${itemId}/${mediaSource.Id}/Subtitles/${stream.Index}/0/Stream.vtt`,
          { ApiKey: session.accessToken },
        ),
        type: "vtt",
        needsProxy: false,
        source: "Jellyfin",
        isHearingImpaired: stream.IsHearingImpaired,
      }),
    );
  return {
    owner: session,
    itemId,
    playSessionId: response.PlaySessionId,
    mediaSource,
    source,
    captions,
    audioIndex: options.audioIndex ?? mediaSource.DefaultAudioStreamIndex,
    subtitleIndex,
    playMethod,
  };
}

export function reportPlayback(
  event: "Playing" | "Progress" | "Stopped",
  playback: JellyfinPlayback,
  state: {
    time: number;
    paused: boolean;
    muted: boolean;
    volume: number;
    subtitleIndex?: number;
  },
) {
  if (!isCurrentSession(playback.owner)) return Promise.resolve();
  const path =
    event === "Playing" ? "/Sessions/Playing" : `/Sessions/Playing/${event}`;
  return jellyfinRequest<void>(path, {
    method: "POST",
    keepalive: event === "Stopped",
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      ItemId: playback.itemId,
      MediaSourceId: playback.mediaSource.Id,
      PlaySessionId: playback.playSessionId,
      PositionTicks: Math.round(Math.max(0, state.time) * 10_000_000),
      IsPaused: state.paused,
      IsMuted: state.muted,
      VolumeLevel: Math.round(state.volume * 100),
      CanSeek: true,
      PlayMethod: playback.playMethod,
      AudioStreamIndex: playback.audioIndex,
      SubtitleStreamIndex: state.subtitleIndex ?? playback.subtitleIndex,
      PlaybackRate: 1,
    }),
  });
}

export async function stopTranscode(playback: JellyfinPlayback) {
  if (!isCurrentSession(playback.owner)) return;
  if (playback.source.type !== "hls") return;
  const session = getJellyfinSession();
  if (!session) return;
  await jellyfinRequest<void>(
    "/Videos/ActiveEncodings",
    { method: "DELETE", keepalive: true },
    {
      deviceId: session.deviceId,
      playSessionId: playback.playSessionId,
    },
  );
}
