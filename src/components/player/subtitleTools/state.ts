import { create } from "zustand";

import { useJellyfinAuth } from "@/stores/jellyfin";
import { Caption } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";

export function subtitleToolIdentity() {
  const player = usePlayerStore.getState();
  return {
    source: player.source,
    itemId: player.meta?.jellyfinItemId,
    session: useJellyfinAuth.getState().session,
  };
}
type SubtitleToolIdentity = ReturnType<typeof subtitleToolIdentity>;

export function matchesSubtitleToolIdentity(identity: SubtitleToolIdentity) {
  const current = subtitleToolIdentity();
  return (
    identity.source === current.source &&
    identity.itemId === current.itemId &&
    identity.session === current.session
  );
}

interface Translation {
  identity: SubtitleToolIdentity;
  original: Caption;
  translated: Caption;
}
interface AutoDelay {
  identity: SubtitleToolIdentity;
  caption: Caption;
  previous: number;
  offset: number;
}

// These records belong to the active playback source, never to exported settings.
export const useSubtitleToolState = create<{
  translation: Translation | null;
  autoDelay: AutoDelay | null;
}>(() => ({ translation: null, autoDelay: null }));

export function applySubtitleTranslation(
  identity: SubtitleToolIdentity,
  caption: Caption,
  translated: Caption,
) {
  if (
    !matchesSubtitleToolIdentity(identity) ||
    usePlayerStore.getState().caption.selected !== caption
  )
    return false;
  const current = useSubtitleToolState.getState().translation;
  useSubtitleToolState.setState({
    translation: {
      identity,
      original: current?.translated === caption ? current.original : caption,
      translated,
    },
  });
  usePlayerStore.getState().setCaption(translated);
  return true;
}

export function restoreSubtitleTranslation() {
  const record = useSubtitleToolState.getState().translation;
  useSubtitleToolState.setState({ translation: null });
  if (
    record &&
    matchesSubtitleToolIdentity(record.identity) &&
    usePlayerStore.getState().caption.selected === record.translated
  )
    usePlayerStore.getState().setCaption(record.original);
}

export function applySubtitleAutoDelay(
  identity: SubtitleToolIdentity,
  caption: Caption,
  offset: number,
) {
  if (
    !matchesSubtitleToolIdentity(identity) ||
    usePlayerStore.getState().caption.selected !== caption ||
    !Number.isFinite(offset)
  )
    return false;
  const current = useSubtitleToolState.getState().autoDelay;
  const delay = useSubtitleStore.getState().delay;
  const previous =
    current && current.caption === caption && delay === current.offset
      ? current.previous
      : delay;
  const applied = Math.max(-500, Math.min(500, offset));
  useSubtitleToolState.setState({
    autoDelay: { identity, caption, previous, offset: applied },
  });
  useSubtitleStore.getState().setDelay(applied);
  return true;
}

export function undoSubtitleAutoDelay() {
  const record = useSubtitleToolState.getState().autoDelay;
  useSubtitleToolState.setState({ autoDelay: null });
  if (
    record &&
    matchesSubtitleToolIdentity(record.identity) &&
    usePlayerStore.getState().caption.selected === record.caption
  )
    useSubtitleStore.getState().setDelay(record.previous);
}

function clearStaleSubtitleTools() {
  const state = useSubtitleToolState.getState();
  const caption = usePlayerStore.getState().caption.selected;
  if (
    state.translation &&
    (!matchesSubtitleToolIdentity(state.translation.identity) ||
      state.translation.translated !== caption)
  )
    useSubtitleToolState.setState({ translation: null });
  if (
    state.autoDelay &&
    (!matchesSubtitleToolIdentity(state.autoDelay.identity) ||
      state.autoDelay.caption !== caption)
  ) {
    useSubtitleToolState.setState({ autoDelay: null });
    if (useSubtitleStore.getState().delay === state.autoDelay.offset)
      useSubtitleStore.getState().setDelay(state.autoDelay.previous);
  }
}
usePlayerStore.subscribe(clearStaleSubtitleTools);
useJellyfinAuth.subscribe(clearStaleSubtitleTools);
