/** Capture only the playing media element, never a microphone or screen. */
export async function capturePlaybackAudio(
  video: HTMLVideoElement,
  signal: AbortSignal,
  progress: (percent: number) => void,
) {
  const element = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  if (video.paused || video.readyState < 3 || video.playbackRate !== 1)
    throw new Error("Play at normal speed before synchronising subtitles.");
  const capture = element.captureStream ?? element.mozCaptureStream;
  if (!capture || !window.MediaRecorder)
    throw new Error(
      "This browser cannot capture playback audio. Use the manual subtitle delay control.",
    );
  const stream = capture.call(element);
  const tracks = stream.getAudioTracks();
  if (!tracks.length) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(
      "This stream does not expose audio for subtitle synchronisation.",
    );
  }
  const startTime = video.currentTime;
  const blob = await new Promise<Blob>((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(new MediaStream(tracks));
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      reject(error);
      return;
    }
    const chunks: Blob[] = [];
    let timer: ReturnType<typeof setInterval>;
    let settled = false;
    const started = performance.now();
    let abort: () => void;
    const cleanup = () => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      stream.getTracks().forEach((track) => track.stop());
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (recorder.state !== "inactive") recorder.stop();
      reject(error);
    };
    abort = () =>
      fail(
        new DOMException("Subtitle synchronisation cancelled.", "AbortError"),
      );
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () =>
      fail(new Error("The browser could not capture playback audio."));
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      recorder.start(1000);
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error("Audio capture is unavailable."),
      );
      return;
    }
    timer = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      if (
        video.paused ||
        video.seeking ||
        video.playbackRate !== 1 ||
        Math.abs(video.currentTime - startTime - elapsed) > 1.5
      ) {
        fail(
          new Error(
            "Playback moved or stopped during capture. Resume playback and try again.",
          ),
        );
        return;
      }
      progress(Math.min(100, Math.round((elapsed / 25) * 100)));
      if (elapsed >= 25) {
        clearInterval(timer);
        recorder.stop();
      }
    }, 250);
  });
  signal.throwIfAborted();
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    signal.throwIfAborted();
    const pcm = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
      const samples = audio.getChannelData(channel);
      for (let i = 0; i < pcm.length; i += 1)
        pcm[i] += samples[i] / audio.numberOfChannels;
    }
    return { pcm, sampleRate: audio.sampleRate, startTime };
  } finally {
    await context.close();
  }
}
