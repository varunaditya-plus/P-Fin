import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { KeyboardCommandsFrame } from "@/components/overlays/KeyboardCommandsFrame";
import { useOverlayStack } from "@/stores/interface/overlayStack";
import { usePreferencesStore } from "@/stores/preferences";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KeyboardShortcutConfig,
  ShortcutId,
  getKeyDisplayName,
  getModifierSymbol,
} from "@/utils/keyboardShortcuts";

interface KeyboardShortcut {
  key: string;
  description: string;
  condition?: string;
  config?: KeyboardShortcutConfig;
}

interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

function KeyBadge({
  config,
  children,
}: {
  config?: KeyboardShortcutConfig;
  children: ReactNode;
}) {
  const modifier = config?.modifier;

  return (
    <kbd className="relative inline-flex items-center justify-center shrink-0 min-w-[1.5rem] h-5 px-1.5 text-[11px] font-mono text-white/40 rounded border border-white/[0.1] bg-white/[0.05]">
      {children}
      {modifier && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none bg-type-link text-white rounded-full w-3 h-3 flex items-center justify-center font-sans font-bold">
          {getModifierSymbol(modifier)}
        </span>
      )}
    </kbd>
  );
}

const getShortcutGroups = (
  t: (key: string) => string,
  shortcuts: Record<string, KeyboardShortcutConfig>,
): ShortcutGroup[] => {
  // Merge user shortcuts with defaults (user shortcuts take precedence)
  const mergedShortcuts = {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    ...shortcuts,
  };

  const getDisplayKey = (shortcutId: ShortcutId): string => {
    const config = mergedShortcuts[shortcutId];
    if (!config?.key) return "";
    return getKeyDisplayName(config.key);
  };

  const getConfig = (
    shortcutId: ShortcutId,
  ): KeyboardShortcutConfig | undefined => {
    return mergedShortcuts[shortcutId];
  };

  return [
    {
      title: t("global.keyboardShortcuts.groups.videoPlayback"),
      shortcuts: [
        {
          key: "Space",
          description: t("global.keyboardShortcuts.shortcuts.playPause"),
        },
        {
          key: "K",
          description: t("global.keyboardShortcuts.shortcuts.playPauseAlt"),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_FORWARD_5),
          description: t("global.keyboardShortcuts.shortcuts.skipForward5"),
          config: getConfig(ShortcutId.SKIP_FORWARD_5),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_BACKWARD_5),
          description: t("global.keyboardShortcuts.shortcuts.skipBackward5"),
          config: getConfig(ShortcutId.SKIP_BACKWARD_5),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_BACKWARD_10),
          description: t("global.keyboardShortcuts.shortcuts.skipBackward10"),
          config: getConfig(ShortcutId.SKIP_BACKWARD_10),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_FORWARD_10),
          description: t("global.keyboardShortcuts.shortcuts.skipForward10"),
          config: getConfig(ShortcutId.SKIP_FORWARD_10),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_FORWARD_1),
          description: t("global.keyboardShortcuts.shortcuts.skipForward1"),
          config: getConfig(ShortcutId.SKIP_FORWARD_1),
        },
        {
          key: getDisplayKey(ShortcutId.SKIP_BACKWARD_1),
          description: t("global.keyboardShortcuts.shortcuts.skipBackward1"),
          config: getConfig(ShortcutId.SKIP_BACKWARD_1),
        },
        {
          key: getDisplayKey(ShortcutId.NEXT_EPISODE),
          description: t("global.keyboardShortcuts.shortcuts.nextEpisode"),
          condition: t("global.keyboardShortcuts.conditions.showsOnly"),
          config: getConfig(ShortcutId.NEXT_EPISODE),
        },
        {
          key: getDisplayKey(ShortcutId.PREVIOUS_EPISODE),
          description: t("global.keyboardShortcuts.shortcuts.previousEpisode"),
          condition: t("global.keyboardShortcuts.conditions.showsOnly"),
          config: getConfig(ShortcutId.PREVIOUS_EPISODE),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.jumpToPosition"),
      shortcuts: [
        {
          key: getDisplayKey(ShortcutId.JUMP_TO_0),
          description: t("global.keyboardShortcuts.shortcuts.jumpTo0"),
          config: getConfig(ShortcutId.JUMP_TO_0),
        },
        {
          key: getDisplayKey(ShortcutId.JUMP_TO_9),
          description: t("global.keyboardShortcuts.shortcuts.jumpTo9"),
          config: getConfig(ShortcutId.JUMP_TO_9),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.audioVideo"),
      shortcuts: [
        {
          key: "↑",
          description: t("global.keyboardShortcuts.shortcuts.increaseVolume"),
        },
        {
          key: "↓",
          description: t("global.keyboardShortcuts.shortcuts.decreaseVolume"),
        },
        {
          key: getDisplayKey(ShortcutId.MUTE),
          description: t("global.keyboardShortcuts.shortcuts.mute"),
          config: getConfig(ShortcutId.MUTE),
        },
        {
          key: getDisplayKey(ShortcutId.TOGGLE_FULLSCREEN),
          description: t("global.keyboardShortcuts.shortcuts.toggleFullscreen"),
          config: getConfig(ShortcutId.TOGGLE_FULLSCREEN),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.subtitlesAccessibility"),
      shortcuts: [
        {
          key: getDisplayKey(ShortcutId.TOGGLE_CAPTIONS),
          description: t("global.keyboardShortcuts.shortcuts.toggleCaptions"),
          config: getConfig(ShortcutId.TOGGLE_CAPTIONS),
        },
        {
          key: getDisplayKey(ShortcutId.RANDOM_CAPTION),
          description: t("global.keyboardShortcuts.shortcuts.randomCaption"),
          config: getConfig(ShortcutId.RANDOM_CAPTION),
        },
        {
          key: getDisplayKey(ShortcutId.SYNC_SUBTITLES_EARLIER),
          description: t(
            "global.keyboardShortcuts.shortcuts.syncSubtitlesEarlier",
          ),
          config: getConfig(ShortcutId.SYNC_SUBTITLES_EARLIER),
        },
        {
          key: getDisplayKey(ShortcutId.SYNC_SUBTITLES_LATER),
          description: t(
            "global.keyboardShortcuts.shortcuts.syncSubtitlesLater",
          ),
          config: getConfig(ShortcutId.SYNC_SUBTITLES_LATER),
        },
        {
          key: getDisplayKey(ShortcutId.TOGGLE_NATIVE_SUBTITLES),
          description: t(
            "global.keyboardShortcuts.shortcuts.toggleNativeSubtitles",
          ),
          config: getConfig(ShortcutId.TOGGLE_NATIVE_SUBTITLES),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.interface"),
      shortcuts: [
        {
          key: getDisplayKey(ShortcutId.BARREL_ROLL),
          description: t("global.keyboardShortcuts.shortcuts.barrelRoll"),
          config: getConfig(ShortcutId.BARREL_ROLL),
        },
        {
          key: "Escape",
          description: t("global.keyboardShortcuts.shortcuts.closeOverlay"),
        },
      ],
    },
  ];
};

interface KeyboardCommandsModalProps {
  id: string;
}

export function KeyboardCommandsModal({ id }: KeyboardCommandsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hideModal = useOverlayStack((state) => state.hideModal);
  const numberSeeking = usePreferencesStore(
    (state) => state.enableNumberKeySeeking,
  );
  const keyboardShortcuts = usePreferencesStore((s) => s.keyboardShortcuts);
  const shortcutGroups = getShortcutGroups(t, keyboardShortcuts);

  return (
    <KeyboardCommandsFrame id={id} title={t("global.keyboardShortcuts.title")}>
      <div className="space-y-4">
        <div className="flex justify-end -mt-2">
          <button
            type="button"
            onClick={() => {
              hideModal(id);
              navigate("/settings?category=settings-preferences");
            }}
            className="tabbable text-xs text-type-link hover:text-white transition-colors"
          >
            {t("global.keyboardShortcuts.editInSettings")}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 max-h-[62vh] overflow-y-auto">
          {shortcutGroups
            .filter(
              (group) =>
                numberSeeking ||
                group.title !==
                  t("global.keyboardShortcuts.groups.jumpToPosition"),
            )
            .map((group) => (
              <div key={group.title}>
                <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-medium mb-1.5">
                  {group.title}
                </h3>
                <div className="space-y-0.5">
                  {group.shortcuts
                    .filter((shortcut) => shortcut.key)
                    .map((shortcut) => (
                      <div
                        key={`${shortcut.description}:${shortcut.key}`}
                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-white/[0.04] transition-colors gap-3"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-white/55">
                            {shortcut.description}
                          </span>
                          {shortcut.condition ? (
                            <span className="text-[10px] text-white/25 italic shrink-0">
                              {shortcut.condition}
                            </span>
                          ) : null}
                        </div>
                        <KeyBadge config={shortcut.config}>
                          {shortcut.key}
                        </KeyBadge>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </KeyboardCommandsFrame>
  );
}
