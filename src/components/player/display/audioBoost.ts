interface AudioGraph {
  context: AudioContext;
  gain: GainNode;
  limiter: DynamicsCompressorNode;
  ready: Promise<void>;
  owners: Set<symbol>;
  removalObserver?: MutationObserver;
}
const graphs = new WeakMap<HTMLVideoElement, AudioGraph>();

export function clampAudioBoost(multiplier: number): number {
  return Number.isFinite(multiplier) ? Math.max(1, Math.min(6, multiplier)) : 1;
}

function applyGain(graph: AudioGraph, multiplier: number) {
  graph.gain.gain.setTargetAtTime(multiplier, graph.context.currentTime, 0.025);
  graph.limiter.ratio.value = multiplier > 1 ? 20 : 1;
}

function isRunning(context: AudioContext) {
  return context.state === "running";
}

async function resumeAudio(context: AudioContext) {
  if (isRunning(context)) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.resume(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Select Enable volume boost to allow audio processing.",
              ),
            ),
          1500,
        );
      }),
    ]);
    if (context.state !== "running")
      throw new Error("Your browser could not enable volume boost.");
  } finally {
    clearTimeout(timeout);
  }
}

function releaseGraph(video: HTMLVideoElement, owner: symbol) {
  const graph = graphs.get(video);
  if (!graph) return;
  graph.owners.delete(owner);
  if (graph.owners.size) return;
  applyGain(graph, 1);
  const closeWhenRemoved = () => {
    if (graph.owners.size) {
      graph.removalObserver?.disconnect();
      graph.removalObserver = undefined;
      return;
    }
    if (video.isConnected) return;
    graph.removalObserver?.disconnect();
    graph.context.close().catch(() => {});
    if (graphs.get(video) === graph) graphs.delete(video);
  };
  // React can transfer the same element during effect cleanup. Reuse its graph
  // until the element actually leaves the document; a media source is single-use.
  queueMicrotask(() => {
    if (!graph.owners.size && video.isConnected) {
      graph.removalObserver = new MutationObserver(closeWhenRemoved);
      graph.removalObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    closeWhenRemoved();
  });
}

function acquireGraph(video: HTMLVideoElement, owner: symbol): AudioGraph {
  const previous = graphs.get(video);
  if (previous) {
    previous.owners.add(owner);
    previous.removalObserver?.disconnect();
    previous.removalObserver = undefined;
    return previous;
  }
  const Context =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context)
    throw new Error("Volume boost is not supported by this browser.");
  const url = new URL(video.currentSrc || video.src, window.location.href);
  if (!video.src || url.origin !== window.location.origin) {
    throw new Error("Volume boost is unavailable for this stream.");
  }
  const context = new Context();
  const gain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  gain.gain.value = 1;
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  gain.connect(limiter);
  limiter.connect(context.destination);
  const graph: AudioGraph = {
    context,
    gain,
    limiter,
    owners: new Set([owner]),
    ready: Promise.resolve(),
  };
  graphs.set(video, graph);
  graph.ready = resumeAudio(context)
    .then(() => {
      if (!graph.owners.size || context.state !== "running")
        throw new Error("Volume boost was cancelled.");
      // Capturing a media element before the context can run would silence it.
      const source = context.createMediaElementSource(video);
      source.connect(gain);
    })
    .catch((error: unknown) => {
      if (graphs.get(video) === graph) graphs.delete(video);
      return context
        .close()
        .catch(() => {})
        .then(() => {
          throw error;
        });
    });
  return graph;
}

export function createAudioBoost() {
  const owner = Symbol("player audio");
  let video: HTMLVideoElement | null = null;
  let generation = 0;
  return {
    attach(next: HTMLVideoElement) {
      if (next === video) return;
      generation += 1;
      if (video) releaseGraph(video, owner);
      video = next;
      const graph = graphs.get(next);
      if (graph) {
        graph.owners.add(owner);
        graph.removalObserver?.disconnect();
        graph.removalObserver = undefined;
      }
    },
    async setBoost(value: number) {
      generation += 1;
      const request = generation;
      const multiplier = clampAudioBoost(value);
      if (multiplier === 1) {
        const graph = video ? graphs.get(video) : undefined;
        if (graph) {
          applyGain(graph, 1);
          await resumeAudio(graph.context);
        }
        return;
      }
      if (!video)
        throw new Error("Start playback before enabling volume boost.");
      const graph = acquireGraph(video, owner);
      await graph.ready;
      await resumeAudio(graph.context);
      if (request === generation) applyGain(graph, multiplier);
    },
    destroy() {
      generation += 1;
      if (video) releaseGraph(video, owner);
      video = null;
    },
  };
}
