// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it, vi } from "vitest";

import {
  installPlaybackCommands,
  interceptPlayback,
  localPlayback,
  selectRemoteItem,
} from "./playbackCommands";

it("routes user controls but bypasses incoming commands, including after exceptions", () => {
  const commands = { play: vi.fn(), pause: vi.fn(), seek: vi.fn() };
  const remove = installPlaybackCommands(commands);
  expect(interceptPlayback("play")).toBe(true);
  expect(commands.play).toHaveBeenCalledOnce();
  expect(localPlayback(() => interceptPlayback("pause"))).toBe(false);
  expect(commands.pause).not.toHaveBeenCalled();
  expect(() =>
    localPlayback(() => {
      throw new Error("test");
    }),
  ).toThrow("test");
  expect(interceptPlayback("seek", 42)).toBe(true);
  expect(commands.seek).toHaveBeenCalledWith(42);
  remove();
  expect(interceptPlayback("play")).toBe(false);
});
it("a stale cleanup cannot remove another remote controller", () => {
  const remove = installPlaybackCommands({
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
  });
  const next = { play: vi.fn(), pause: vi.fn(), seek: vi.fn() };
  const removeNext = installPlaybackCommands(next);
  remove();
  interceptPlayback("play");
  expect(next.play).toHaveBeenCalledOnce();
  removeNext();
});

it("routes explicit episode selection only while a group controller owns playback", () => {
  const selectItem = vi.fn();
  expect(selectRemoteItem("episode")).toBe(false);
  const remove = installPlaybackCommands({
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    selectItem,
  });
  expect(selectRemoteItem("episode", 0)).toBe(true);
  expect(selectItem).toHaveBeenCalledWith("episode", 0);
  expect(localPlayback(() => selectRemoteItem("incoming"))).toBe(false);
  remove();
  expect(selectRemoteItem("episode")).toBe(false);
});
