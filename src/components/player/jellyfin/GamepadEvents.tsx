import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useVolume } from "@/components/player/hooks/useVolume";
import { useInternalOverlayRouter } from "@/hooks/useOverlayRouter";
import { pollGamepad, useGamepadStore } from "@/stores/gamepad";
import { PlayerHoverState } from "@/stores/player/slices/interface";
import { usePlayerStore } from "@/stores/player/store";

import { useJellyfinPlayback } from "./JellyfinPlaybackContext";

function moveFocus(root: HTMLElement, direction: string) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ),
  ).filter(
    (node) =>
      node.getClientRects().length && !node.closest('[aria-hidden="true"]'),
  );
  const current = document.activeElement as HTMLElement;
  if (!candidates.includes(current)) {
    candidates[0]?.focus();
    return;
  }
  const rect = current.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const horizontal = direction === "left" || direction === "right";
  const positive = direction === "down" || direction === "right";
  const ranked = candidates
    .filter((node) => node !== current)
    .map((node) => {
      const r = node.getBoundingClientRect();
      const dx = r.x + r.width / 2 - x;
      const dy = r.y + r.height / 2 - y;
      const along = horizontal ? dx : dy;
      return {
        node,
        along,
        distance: Math.abs(along) + Math.abs(horizontal ? dy : dx) * 3,
      };
    })
    .filter(({ along }) => (positive ? along > 1 : along < -1))
    .sort((a, b) => a.distance - b.distance);
  ranked[0]?.node.focus();
}

export function GamepadEvents() {
  const enabled = useGamepadStore((s) => s.enabled);
  const controls = useJellyfinPlayback();
  const { toggleMute } = useVolume();
  const mute = useRef(toggleMute);
  mute.current = toggleMute;
  const latest = useRef(controls);
  latest.current = controls;
  const anchor = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();
  const router = useInternalOverlayRouter("settings");
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    if (!enabled || !navigator.getGamepads) return;
    const held = new Map<string, number>();
    let raf = 0;
    let lastPad = -1;
    const poll = (now: number) => {
      if (document.hidden || !document.hasFocus()) held.clear();
      else {
        const pad = Array.from(navigator.getGamepads()).find(
          (entry) => entry?.connected,
        );
        if (pad?.index !== lastPad) {
          held.clear();
          lastPad = pad?.index ?? -1;
        }
        if (pad)
          for (const action of pollGamepad(
            pad,
            useGamepadStore.getState().mapping,
            held,
            now,
          )) {
            const state = usePlayerStore.getState();
            const c = latest.current;
            const display = state.display;
            state.updateInterfaceHovering(PlayerHoverState.MOUSE_HOVER);
            const overlay = routerRef.current;
            const container =
              anchor.current?.closest<HTMLElement>(".popout-location");
            const root = overlay.currentRoute
              ? container?.querySelector<HTMLElement>(".popout-wrapper")
              : container;
            const index = c.episodes.findIndex(
              (episode) => episode.Id === c.itemId,
            );
            switch (action) {
              case "play":
                if (state.mediaPlaying.isPaused) display?.play();
                else display?.pause();
                break;
              case "rewind":
                display?.setTime(Math.max(0, state.progress.time - 10));
                break;
              case "forward":
                display?.setTime(
                  Math.min(state.progress.duration, state.progress.time + 10),
                );
                break;
              case "mute":
                mute.current();
                break;
              case "quieter":
                display?.setVolume(
                  Math.max(0, state.mediaPlaying.volume - 0.05),
                );
                break;
              case "louder":
                display?.setVolume(
                  Math.min(1, state.mediaPlaying.volume + 0.05),
                );
                break;
              case "fullscreen":
                display?.toggleFullscreen();
                break;
              case "captions":
                c.changeSubtitle(
                  c.subtitleIndex >= 0
                    ? -1
                    : Number(
                        state.captionList[0]?.id.replace("jellyfin-", "") ?? -1,
                      ),
                );
                break;
              case "next":
                if (!c.busy && index >= 0 && c.episodes[index + 1])
                  c.playItem(c.episodes[index + 1].Id, true);
                break;
              case "previous":
                if (!c.busy && index > 0) c.playItem(c.episodes[index - 1].Id);
                break;
              case "settings":
                overlay.open();
                break;
              case "back":
                if (overlay.currentRoute) overlay.close();
                else navigate("/");
                break;
              case "confirm":
                if (root?.contains(document.activeElement))
                  (document.activeElement as HTMLElement).click();
                else if (root) moveFocus(root, "right");
                break;
              case "up":
              case "down":
              case "left":
              case "right":
                if (root) moveFocus(root, action);
                break;
              default:
                break;
            }
          }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled, navigate]);
  return <span hidden ref={anchor} />;
}
