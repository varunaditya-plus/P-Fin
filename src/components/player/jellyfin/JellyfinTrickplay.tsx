import { useContext, useState } from "react";

import { jellyfinUrl } from "@/backend/jellyfin/client";
import { trickplayFrame } from "@/backend/jellyfin/trickplay";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { JellyfinPlaybackContext } from "./JellyfinPlaybackContext";

export function JellyfinTrickplay({ time }: { time: number }) {
  const controls = useContext(JellyfinPlaybackContext);
  const session = useJellyfinAuth((s) => s.session);
  const [failed, setFailed] = useState("");
  const sourceId = controls?.playback?.mediaSource.Id ?? controls?.itemId;
  const frame = sourceId
    ? trickplayFrame(controls?.trickplay, sourceId, time)
    : null;
  if (!frame || !controls || !session) return null;
  const url = jellyfinUrl(
    `/Videos/${controls.itemId}/Trickplay/${frame.Width}/${frame.sheet}.jpg`,
    {
      mediaSourceId: sourceId,
      ApiKey: session.accessToken,
    },
  );
  if (failed === url) return null;
  const scale = Math.min(1, 240 / frame.Width);
  return (
    <div
      className="mx-auto overflow-hidden rounded-lg bg-black shadow-xl"
      style={{ width: frame.Width * scale, height: frame.Height * scale }}
    >
      <img
        src={url}
        alt=""
        onError={() => setFailed(url)}
        style={{
          width: frame.Width * frame.TileWidth * scale,
          maxWidth: "none",
          transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)`,
        }}
      />
    </div>
  );
}
