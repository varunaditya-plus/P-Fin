import type { PgsRenderer } from "libbitsub";
import { RefObject, useContext, useEffect, useRef } from "react";

import { JellyfinPlaybackContext } from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { Caption } from "@/stores/player/slices/source";
import { useSubtitleStore } from "@/stores/subtitles";

export function BitmapCaptions({
  video,
  caption,
}: {
  video: RefObject<HTMLVideoElement>;
  caption: Caption;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<PgsRenderer>();
  const delay = useSubtitleStore((state) => state.delay);
  const playback = useContext(JellyfinPlaybackContext);
  const failed = useRef(playback?.subtitleFailed);
  failed.current = playback?.subtitleFailed;

  useEffect(() => {
    let disposed = false;
    let current: PgsRenderer | undefined;
    const onError = () => {
      if (!disposed) failed.current?.(caption);
    };
    import("libbitsub")
      .then(({ PgsRenderer: Renderer }) => {
        if (disposed || !video.current || !canvas.current) return;
        current = new Renderer({
          video: video.current,
          canvas: canvas.current,
          subUrl: caption.url,
          timeOffset: -useSubtitleStore.getState().delay,
          streamingLoad: true,
          rangeRequests: true,
          prefetchWindow: { before: 1, after: 2 },
          onError,
        });
        renderer.current = current;
      })
      .catch(onError);
    return () => {
      disposed = true;
      current?.dispose();
      if (renderer.current === current) renderer.current = undefined;
    };
  }, [caption, video]);

  useEffect(() => {
    if (renderer.current) renderer.current.timeOffset = -delay;
  }, [delay]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      data-bitmap-subtitles
      className="pointer-events-none absolute z-40"
    />
  );
}
