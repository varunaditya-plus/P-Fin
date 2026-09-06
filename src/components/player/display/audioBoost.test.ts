// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioBoost } from "./audioBoost";

const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
let suspended = false;
class TestContext {
  // eslint-disable-next-line no-use-before-define
  static instances: TestContext[] = [];

  state = suspended ? "suspended" : "running";

  currentTime = 0;

  destination = {};

  gain = { gain: parameter(), connect: vi.fn() };

  limiter = {
    threshold: parameter(),
    knee: parameter(),
    ratio: parameter(),
    attack: parameter(),
    release: parameter(),
    connect: vi.fn(),
  };

  source = { connect: vi.fn() };

  createGain = vi.fn(() => this.gain);

  createDynamicsCompressor = vi.fn(() => this.limiter);

  createMediaElementSource = vi.fn(() => this.source);

  resume = vi.fn(() =>
    suspended ? new Promise<void>(() => {}) : Promise.resolve(),
  );

  close = vi.fn(async () => {
    this.state = "closed";
  });

  constructor() {
    TestContext.instances.push(this);
  }
}
function setup() {
  const video = document.createElement("video");
  video.src = "/jellyfin/video.mp4";
  const boost = createAudioBoost();
  boost.attach(video);
  return { video, boost };
}
beforeEach(() => {
  TestContext.instances = [];
  suspended = false;
  vi.stubGlobal("AudioContext", TestContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("optional volume boost", () => {
  it("leaves default audio untouched and reuses one graph for slider/source changes", async () => {
    const { video, boost } = setup();
    await boost.setBoost(1);
    expect(TestContext.instances).toHaveLength(0);
    await boost.setBoost(2);
    const context = TestContext.instances[0];
    video.src = "/jellyfin/another-track.mp4";
    await boost.setBoost(3);
    expect(TestContext.instances).toHaveLength(1);
    expect(context.createMediaElementSource).toHaveBeenCalledOnce();
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      3,
      0,
      0.025,
    );
    await boost.setBoost(1);
    expect(context.limiter.ratio.value).toBe(1);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1,
      0,
      0.025,
    );
    boost.destroy();
    await Promise.resolve();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("does not capture or silence the video if the browser blocks audio activation", async () => {
    vi.useFakeTimers();
    suspended = true;
    const { boost } = setup();
    const result = expect(boost.setBoost(2)).rejects.toThrow(
      "Enable volume boost",
    );
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    const context = TestContext.instances[0];
    expect(context.createMediaElementSource).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
    boost.destroy();
  });

  it("rejects cross-origin streams before creating an audio graph", async () => {
    const { video, boost } = setup();
    video.src = "https://unrelated.example/video.mp4";
    await expect(boost.setBoost(2)).rejects.toThrow(
      "unavailable for this stream",
    );
    expect(TestContext.instances).toHaveLength(0);
    boost.destroy();
  });

  it("does not let an earlier boost request override a later reset", async () => {
    const { boost } = setup();
    const pending = boost.setBoost(6);
    await boost.setBoost(1);
    await pending;
    const context = TestContext.instances[0];
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1,
      0,
      0.025,
    );
    boost.destroy();
  });
});
