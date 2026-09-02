import { JellyfinMediaSource } from "@/backend/jellyfin/client";

export interface JellyfinTrackChoice {
  audioIndex?: number;
  subtitleIndex?: number;
}

export function JellyfinTrackSelection({
  source,
  value,
  onChange,
}: {
  source: JellyfinMediaSource;
  value: JellyfinTrackChoice;
  onChange: (value: JellyfinTrackChoice) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(["Audio", "Subtitle"] as const).map((kind) => {
        const streams =
          source.MediaStreams?.filter((stream) => stream.Type === kind) ?? [];
        const field = kind === "Audio" ? "audioIndex" : "subtitleIndex";
        if (!streams.length) return null;
        return (
          <label
            key={kind}
            className="min-w-0 space-y-2 text-sm text-type-secondary"
          >
            <span>{kind === "Audio" ? "Audio" : "Subtitles"}</span>
            <select
              className="block w-full truncate rounded-xl bg-dropdown-background py-3 pl-3 pr-8 text-white tabbable"
              value={value[field] ?? "default"}
              onChange={(event) =>
                onChange({
                  ...value,
                  [field]:
                    event.target.value === "default"
                      ? undefined
                      : Number(event.target.value),
                })
              }
            >
              <option value="default">Use saved preference</option>
              {kind === "Subtitle" ? <option value={-1}>Off</option> : null}
              {streams.map((stream) => (
                <option key={stream.Index} value={stream.Index}>
                  {stream.DisplayTitle ??
                    stream.Title ??
                    stream.Language ??
                    `Track ${stream.Index + 1}`}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
