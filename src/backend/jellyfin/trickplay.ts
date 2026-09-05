import { JellyfinItem } from "./client";

export function trickplayFrame(
  data: JellyfinItem["Trickplay"],
  sourceId: string,
  time: number,
) {
  const sizes = Object.values(data?.[sourceId] ?? {}).filter((value) =>
    [
      value.Width,
      value.Height,
      value.TileWidth,
      value.TileHeight,
      value.ThumbnailCount,
      value.Interval,
    ].every((number) => Number.isFinite(number) && number > 0),
  );
  const info = sizes.sort((a, b) => a.Width - b.Width)[0];
  if (!info || !Number.isFinite(time)) return null;
  const frame = Math.min(
    info.ThumbnailCount - 1,
    Math.max(0, Math.floor((time * 1000) / info.Interval)),
  );
  const perSheet = info.TileWidth * info.TileHeight;
  const local = frame % perSheet;
  return {
    ...info,
    sheet: Math.floor(frame / perSheet),
    x: (local % info.TileWidth) * info.Width,
    y: Math.floor(local / info.TileWidth) * info.Height,
  };
}
