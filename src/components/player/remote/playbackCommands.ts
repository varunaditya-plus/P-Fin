export interface PlaybackCommands {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  selectItem?: (id: string, ticks?: number) => void;
}
let commands: PlaybackCommands | null = null;
let localDepth = 0;

/** The active remote mode owns controls, while incoming commands bypass routing. */
export function interceptPlayback(
  command: "play" | "pause" | "seek",
  seconds = 0,
) {
  if (!commands || localDepth) return false;
  if (command === "seek") commands.seek(seconds);
  else commands[command]();
  return true;
}
export function installPlaybackCommands(value: PlaybackCommands) {
  commands = value;
  return () => {
    if (commands === value) commands = null;
  };
}
export function localPlayback<T>(action: () => T): T {
  localDepth += 1;
  try {
    return action();
  } finally {
    localDepth -= 1;
  }
}

export function selectRemoteItem(id: string, ticks?: number) {
  if (!commands?.selectItem || localDepth) return false;
  commands.selectItem(id, ticks);
  return true;
}
