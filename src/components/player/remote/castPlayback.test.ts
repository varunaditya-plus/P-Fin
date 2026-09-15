// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";

import {
  allowLocalPlaybackRecovery,
  castReturnTarget,
  suspendLocalCastPlayback,
} from "./castPlayback";
import { installPlaybackCommands, interceptPlayback } from "./playbackCommands";

it("returns the actual receiver item and position after joining another title", () => {
  expect(
    castReturnTarget(
      { ItemId: "remote-B", PlayState: { PositionTicks: 300 } },
      { itemId: "local-A", positionTicks: 100 },
    ),
  ).toEqual({ itemId: "remote-B", positionTicks: 300 });
  expect(
    castReturnTarget(
      { NowPlayingItem: { Id: "remote-B" } },
      { itemId: "local-A", positionTicks: 100 },
    ),
  ).toEqual({ itemId: "remote-B", positionTicks: 0 });
  expect(
    castReturnTarget(null, { itemId: "remote-B", positionTicks: 300 }),
  ).toEqual({ itemId: "remote-B", positionTicks: 300 });
});
it("unloads the local stream and bypasses remote command routing on cast handoff", () => {
  const pauseCommand = vi.fn();
  const remove = installPlaybackCommands({
    play: vi.fn(),
    pause: pauseCommand,
    seek: vi.fn(),
  });
  const pause = vi.fn(() => {
    interceptPlayback("pause");
  });
  const load = vi.fn();
  suspendLocalCastPlayback({ pause, load } as unknown as DisplayInterface);
  expect(pause).toHaveBeenCalledOnce();
  expect(pauseCommand).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledWith(
    expect.objectContaining({ source: null, autoplay: false }),
  );
  remove();
});
it("only enables local error and loading recovery after cast handoff has finished", () => {
  expect(allowLocalPlaybackRecovery(true, false)).toBe(false);
  expect(allowLocalPlaybackRecovery(false, true)).toBe(false);
  expect(allowLocalPlaybackRecovery(true, true)).toBe(false);
  expect(allowLocalPlaybackRecovery(false, false)).toBe(true);
});
