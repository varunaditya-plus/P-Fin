import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { Toggle } from "@/components/buttons/Toggle";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { KeyboardCommandsFrame } from "@/components/overlays/KeyboardCommandsFrame";
import { useModal } from "@/components/overlays/Modal";
import { useOverlayStack } from "@/stores/interface/overlayStack";
import { usePreferencesStore } from "@/stores/preferences";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KeyboardModifier,
  KeyboardShortcutConfig,
  KeyboardShortcuts,
  LOCKED_SHORTCUT_IDS,
  ShortcutId,
  findConflicts,
  getKeyDisplayName,
  getModifierSymbol,
  isNumberKey,
} from "@/utils/keyboardShortcuts";

interface KeyboardShortcut {
  id: ShortcutId;
  config: KeyboardShortcutConfig;
  description: string;
  condition?: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

function KeyBadge({
  config,
  children,
  onClick,
  editing,
  hasConflict,
  label,
}: {
  config?: KeyboardShortcutConfig;
  children: ReactNode;
  onClick?: () => void;
  editing?: boolean;
  hasConflict?: boolean;
  label?: string;
}) {
  const modifier = config?.modifier;

  const content = (
    <>
      {children}
      {modifier ? (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none bg-type-link text-white rounded-full w-3 h-3 flex items-center justify-center font-sans font-bold">
          {getModifierSymbol(modifier)}
        </span>
      ) : null}
    </>
  );
  const className = `relative inline-flex items-center justify-center shrink-0 min-w-[1.75rem] h-6 px-1.5 text-[11px] font-mono rounded border transition-colors ${hasConflict ? "border-type-danger text-type-danger bg-type-danger/10" : "border-white/[0.1] text-white/40"} ${onClick ? "tabbable hover:bg-white/[0.08] hover:text-white/70" : "bg-white/[0.05]"} ${editing ? "ring-2 ring-type-link" : ""}`;
  return onClick ? (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <kbd className={className}>{content}</kbd>
  );
}

const getShortcutGroups = (
  t: (key: string) => string,
  shortcuts: KeyboardShortcuts,
): ShortcutGroup[] => {
  return [
    {
      title: t("global.keyboardShortcuts.groups.videoPlayback"),
      shortcuts: [
        {
          id: ShortcutId.SKIP_FORWARD_5,
          config: shortcuts[ShortcutId.SKIP_FORWARD_5],
          description: t("global.keyboardShortcuts.shortcuts.skipForward5"),
        },
        {
          id: ShortcutId.SKIP_BACKWARD_5,
          config: shortcuts[ShortcutId.SKIP_BACKWARD_5],
          description: t("global.keyboardShortcuts.shortcuts.skipBackward5"),
        },
        {
          id: ShortcutId.SKIP_FORWARD_10,
          config: shortcuts[ShortcutId.SKIP_FORWARD_10],
          description: t("global.keyboardShortcuts.shortcuts.skipForward10"),
        },
        {
          id: ShortcutId.SKIP_BACKWARD_10,
          config: shortcuts[ShortcutId.SKIP_BACKWARD_10],
          description: t("global.keyboardShortcuts.shortcuts.skipBackward10"),
        },
        {
          id: ShortcutId.SKIP_FORWARD_1,
          config: shortcuts[ShortcutId.SKIP_FORWARD_1],
          description: t("global.keyboardShortcuts.shortcuts.skipForward1"),
        },
        {
          id: ShortcutId.SKIP_BACKWARD_1,
          config: shortcuts[ShortcutId.SKIP_BACKWARD_1],
          description: t("global.keyboardShortcuts.shortcuts.skipBackward1"),
        },
        {
          id: ShortcutId.NEXT_EPISODE,
          config: shortcuts[ShortcutId.NEXT_EPISODE],
          description: t("global.keyboardShortcuts.shortcuts.nextEpisode"),
          condition: t("global.keyboardShortcuts.conditions.showsOnly"),
        },
        {
          id: ShortcutId.PREVIOUS_EPISODE,
          config: shortcuts[ShortcutId.PREVIOUS_EPISODE],
          description: t("global.keyboardShortcuts.shortcuts.previousEpisode"),
          condition: t("global.keyboardShortcuts.conditions.showsOnly"),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.audioVideo"),
      shortcuts: [
        {
          id: ShortcutId.MUTE,
          config: shortcuts[ShortcutId.MUTE],
          description: t("global.keyboardShortcuts.shortcuts.mute"),
        },
        {
          id: ShortcutId.TOGGLE_FULLSCREEN,
          config: shortcuts[ShortcutId.TOGGLE_FULLSCREEN],
          description: t("global.keyboardShortcuts.shortcuts.toggleFullscreen"),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.subtitlesAccessibility"),
      shortcuts: [
        {
          id: ShortcutId.TOGGLE_CAPTIONS,
          config: shortcuts[ShortcutId.TOGGLE_CAPTIONS],
          description: t("global.keyboardShortcuts.shortcuts.toggleCaptions"),
        },
        {
          id: ShortcutId.RANDOM_CAPTION,
          config: shortcuts[ShortcutId.RANDOM_CAPTION],
          description: t("global.keyboardShortcuts.shortcuts.randomCaption"),
        },
        {
          id: ShortcutId.SYNC_SUBTITLES_EARLIER,
          config: shortcuts[ShortcutId.SYNC_SUBTITLES_EARLIER],
          description: t(
            "global.keyboardShortcuts.shortcuts.syncSubtitlesEarlier",
          ),
        },
        {
          id: ShortcutId.SYNC_SUBTITLES_LATER,
          config: shortcuts[ShortcutId.SYNC_SUBTITLES_LATER],
          description: t(
            "global.keyboardShortcuts.shortcuts.syncSubtitlesLater",
          ),
        },
        {
          id: ShortcutId.TOGGLE_NATIVE_SUBTITLES,
          config: shortcuts[ShortcutId.TOGGLE_NATIVE_SUBTITLES],
          description: t(
            "global.keyboardShortcuts.shortcuts.toggleNativeSubtitles",
          ),
        },
      ],
    },
    {
      title: t("global.keyboardShortcuts.groups.interface"),
      shortcuts: [
        {
          id: ShortcutId.BARREL_ROLL,
          config: shortcuts[ShortcutId.BARREL_ROLL],
          description: t("global.keyboardShortcuts.shortcuts.barrelRoll"),
        },
      ],
    },
  ];
};

interface KeyboardCommandsEditModalProps {
  id: string;
}

export function KeyboardCommandsEditModal({
  id,
}: KeyboardCommandsEditModalProps) {
  const { t } = useTranslation();
  const { hideModal } = useOverlayStack();
  const modal = useModal(id);
  const keyboardShortcuts = usePreferencesStore((s) => s.keyboardShortcuts);
  const setKeyboardShortcuts = usePreferencesStore(
    (s) => s.setKeyboardShortcuts,
  );
  const enableNumberKeySeeking = usePreferencesStore(
    (s) => s.enableNumberKeySeeking,
  );
  const setEnableNumberKeySeeking = usePreferencesStore(
    (s) => s.setEnableNumberKeySeeking,
  );

  const [editingShortcuts, setEditingShortcuts] =
    useState<KeyboardShortcuts>(keyboardShortcuts);
  const [editingId, setEditingId] = useState<ShortcutId | null>(null);
  const [editingModifier, setEditingModifier] = useState<KeyboardModifier | "">(
    "",
  );
  const [editingKey, setEditingKey] = useState<string>("");
  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const [editingEnableNumberKeySeeking, setEditingEnableNumberKeySeeking] =
    useState(enableNumberKeySeeking);

  const wasShown = useRef(false);
  useEffect(() => {
    if (modal.isShown && !wasShown.current) {
      setEditingShortcuts(keyboardShortcuts);
      setEditingEnableNumberKeySeeking(enableNumberKeySeeking);
    }
    if (!modal.isShown || !wasShown.current) {
      setEditingId(null);
      setEditingModifier("");
      setEditingKey("");
      setIsCapturingKey(false);
    }
    wasShown.current = modal.isShown;
  }, [modal.isShown, keyboardShortcuts, enableNumberKeySeeking]);

  const shortcutGroups = getShortcutGroups(t, editingShortcuts).map(
    (group) => ({
      ...group,
      shortcuts: group.shortcuts.filter(
        (s) => !LOCKED_SHORTCUT_IDS.includes(s.id),
      ),
    }),
  );
  const conflicts = findConflicts(editingShortcuts);
  const conflictIds = new Set<string>();
  conflicts.forEach((conflict: { id1: string; id2: string }) => {
    conflictIds.add(conflict.id1);
    conflictIds.add(conflict.id2);
  });

  const modifierOptions = [
    { id: "", name: "None" },
    { id: "Shift", name: "Shift" },
    { id: "Alt", name: "Alt" },
  ];

  const handleStartEdit = useCallback(
    (shortcutId: ShortcutId) => {
      const config = editingShortcuts[shortcutId];
      setEditingId(shortcutId);
      setEditingModifier(config?.modifier || "");
      setEditingKey(config?.key || "");
      setIsCapturingKey(true);
    },
    [editingShortcuts],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingModifier("");
    setEditingKey("");
    setIsCapturingKey(false);
  }, []);

  const handleKeyCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingKey || !editingId) return;

      // Don't capture modifier keys alone
      if (
        event.key === "Shift" ||
        event.key === "Alt" ||
        event.key === "Control" ||
        event.key === "Meta" ||
        event.key === "Escape"
      ) {
        return;
      }

      // Block number keys (0-9) - they're reserved for progress skipping
      if (isNumberKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        setIsCapturingKey(false);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setEditingKey(event.key);
      setIsCapturingKey(false);
    },
    [isCapturingKey, editingId],
  );

  useEffect(() => {
    if (isCapturingKey) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          handleCancelEdit();
        }
      };
      window.addEventListener("keydown", handleKeyCapture);
      window.addEventListener("keydown", handleEscape);
      return () => {
        window.removeEventListener("keydown", handleKeyCapture);
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isCapturingKey, handleKeyCapture, handleCancelEdit]);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;

    const newConfig: KeyboardShortcutConfig = {
      modifier: editingModifier || undefined,
      key: editingKey || undefined,
    };

    setEditingShortcuts((prev: KeyboardShortcuts) => ({
      ...prev,
      [editingId]: newConfig,
    }));

    handleCancelEdit();
  }, [editingId, editingModifier, editingKey, handleCancelEdit]);

  const handleResetShortcut = useCallback((shortcutId: ShortcutId) => {
    setEditingShortcuts((prev: KeyboardShortcuts) => ({
      ...prev,
      [shortcutId]: DEFAULT_KEYBOARD_SHORTCUTS[shortcutId],
    }));
  }, []);

  const handleResetAll = useCallback(() => {
    setEditingShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
  }, []);

  const handleSave = useCallback(() => {
    setKeyboardShortcuts(editingShortcuts);
    setEnableNumberKeySeeking(editingEnableNumberKeySeeking);

    hideModal(id);
  }, [
    editingShortcuts,
    editingEnableNumberKeySeeking,
    setKeyboardShortcuts,
    setEnableNumberKeySeeking,
    hideModal,
    id,
  ]);

  const handleCancel = useCallback(() => {
    hideModal(id);
  }, [hideModal, id]);

  return (
    <KeyboardCommandsFrame id={id} title={t("global.keyboardShortcuts.title")}>
      <div className="space-y-5 !text-base">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            {t("global.keyboardShortcuts.clickToEdit")}
          </p>
          {conflicts.length > 0 ? (
            <p className="text-xs text-type-danger shrink-0">
              {conflicts.length}{" "}
              {t(
                conflicts.length > 1
                  ? "global.keyboardShortcuts.conflicts"
                  : "global.keyboardShortcuts.conflict",
              )}{" "}
              {t("global.keyboardShortcuts.detected")}
            </p>
          ) : null}
        </div>
        <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-medium">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((shortcut) => {
                  const isEditing = editingId === shortcut.id;
                  const hasConflict = conflictIds.has(shortcut.id);
                  const config = editingShortcuts[shortcut.id];

                  return (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between gap-3 py-1 px-1.5 rounded hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-2">
                              <Dropdown
                                selectedItem={
                                  modifierOptions.find(
                                    (opt) => opt.id === editingModifier,
                                  ) || modifierOptions[0]
                                }
                                setSelectedItem={(item) =>
                                  setEditingModifier(
                                    item.id as KeyboardModifier | "",
                                  )
                                }
                                options={modifierOptions}
                                className="w-28 !my-0 text-xs"
                              />
                              <KeyBadge
                                config={
                                  editingKey
                                    ? {
                                        modifier: editingModifier || undefined,
                                        key: editingKey,
                                      }
                                    : undefined
                                }
                                editing
                              >
                                {isCapturingKey
                                  ? t("global.keyboardShortcuts.pressKey")
                                  : editingKey
                                    ? getKeyDisplayName(editingKey)
                                    : t("global.keyboardShortcuts.none")}
                              </KeyBadge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                theme="secondary"
                                onClick={handleSaveEdit}
                                className="px-2 py-1 !text-xs"
                              >
                                {t("global.keyboardShortcuts.save")}
                              </Button>
                              <Button
                                theme="secondary"
                                onClick={handleCancelEdit}
                                className="px-2 py-1 !text-xs"
                              >
                                {t("global.keyboardShortcuts.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <KeyBadge
                              config={config}
                              label={`Edit ${shortcut.description}`}
                              onClick={() => handleStartEdit(shortcut.id)}
                              hasConflict={hasConflict}
                            >
                              {config?.key
                                ? getKeyDisplayName(config.key)
                                : t("global.keyboardShortcuts.none")}
                            </KeyBadge>
                            <span className="text-xs text-white/55">
                              {shortcut.description}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {shortcut.condition && !isEditing && (
                          <span className="text-[10px] text-white/25 italic shrink-0">
                            {shortcut.condition}
                          </span>
                        )}
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => handleResetShortcut(shortcut.id)}
                            className="tabbable text-white/25 hover:text-white/70 transition-colors shrink-0"
                            title={t("global.keyboardShortcuts.resetToDefault")}
                          >
                            <Icon icon={Icons.RELOAD} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 border-t border-white/10">
            <div className="flex-1">
              <p className="text-sm font-medium text-white/70">
                {t("global.keyboardShortcuts.numberKeySeeking")}
              </p>
              <p className="text-xs text-white/40">
                {t("global.keyboardShortcuts.numberKeySeekingDescription")}
              </p>
            </div>
            <Toggle
              enabled={editingEnableNumberKeySeeking}
              onClick={() =>
                setEditingEnableNumberKeySeeking(!editingEnableNumberKeySeeking)
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleResetAll}
            className="tabbable mr-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <Icon icon={Icons.RELOAD} />
            {t("global.keyboardShortcuts.resetAllToDefault")}
          </button>
          <Button theme="secondary" onClick={handleCancel}>
            {t("global.keyboardShortcuts.cancel")}
          </Button>
          <Button theme="purple" onClick={handleSave}>
            {t("global.keyboardShortcuts.saveChanges")}
          </Button>
        </div>
      </div>
    </KeyboardCommandsFrame>
  );
}
