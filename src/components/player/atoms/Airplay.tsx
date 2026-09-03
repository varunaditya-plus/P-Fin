import { Icons } from "@/components/Icon";
import { VideoPlayerButton } from "@/components/player/internals/Button";
import { usePlayerStore } from "@/stores/player/store";
import { isSafari } from "@/utils/detectFeatures";

export function Airplay() {
  const canAirplay = usePlayerStore((s) => s.interface.canAirplay);
  const display = usePlayerStore((s) => s.display);
  const source = usePlayerStore((s) => s.source);

  if ((!canAirplay && !isSafari) || !source) return null;

  return (
    <VideoPlayerButton
      onClick={() => display?.startAirplay()}
      icon={Icons.AIRPLAY}
    />
  );
}
