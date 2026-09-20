import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Menu } from "@/components/player/internals/ContextMenu";
import { timedTextToSrt } from "@/components/player/utils/ttml";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePlayerStore } from "@/stores/player/store";

import { useSubtitleTools, validateSubtitleTools } from "./preferences";
import {
  applySubtitleTranslation,
  restoreSubtitleTranslation,
  subtitleToolIdentity,
  useSubtitleToolState,
} from "./state";
import { transcriptCues, translateTranscript } from "./transcript";

const languages = [
  "am",
  "ar",
  "eu",
  "bn",
  "pt-BR",
  "bg",
  "ca",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fil",
  "fi",
  "fr",
  "de",
  "el",
  "gu",
  "he",
  "hi",
  "hu",
  "is",
  "id",
  "it",
  "ja",
  "kn",
  "ko",
  "lv",
  "lt",
  "ms",
  "ml",
  "mr",
  "no",
  "pl",
  "pt-PT",
  "ro",
  "ru",
  "sr",
  "zh-CN",
  "sk",
  "sl",
  "es",
  "sw",
  "sv",
  "ta",
  "te",
  "th",
  "zh-TW",
  "tr",
  "ur",
  "uk",
  "vi",
  "cy",
];
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
export function subtitleLanguageName(language: string) {
  try {
    return languageNames.of(language) ?? language;
  } catch {
    return language;
  }
}

export function TranslationView() {
  const router = useOverlayRouter("settings");
  const caption = usePlayerStore((state) => state.caption.selected);
  const source = usePlayerStore((state) => state.source);
  const itemId = usePlayerStore((state) => state.meta?.jellyfinItemId);
  const session = useJellyfinAuth((state) => state.session);
  const preferences = useSubtitleTools();
  const [endpoint, setEndpoint] = useState(preferences.translationEndpoint);
  const [apiKey, setApiKey] = useState("");
  const [configure, setConfigure] = useState(!preferences.translationEndpoint);
  const [target, setTarget] = useState(preferences.targetLanguage);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const original = useSubtitleToolState((state) => state.translation?.original);
  const controller = useRef<AbortController>();
  const parsed = useMemo(() => {
    try {
      return caption ? transcriptCues(caption.srtData) : [];
    } catch {
      return [];
    }
  }, [caption]);
  useEffect(() => {
    setError("");
    return () => controller.current?.abort();
  }, [caption, source, itemId, session]);
  const translate = async (language: string) => {
    if (!caption || !parsed.length || progress !== null) return;
    const request = new AbortController();
    const identity = subtitleToolIdentity();
    controller.current = request;
    setTarget(language);
    setError("");
    setProgress(0);
    try {
      useSubtitleTools.setState(
        validateSubtitleTools({
          ...preferences,
          translationEndpoint: endpoint,
          targetLanguage: language,
        }),
      );
      const cues = await translateTranscript(
        parsed,
        endpoint,
        language,
        apiKey,
        request.signal,
        setProgress,
      );
      if (!request.signal.aborted)
        applySubtitleTranslation(identity, caption, {
          ...caption,
          language,
          srtData: timedTextToSrt(cues),
        });
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Translation failed.",
        );
    } finally {
      setProgress(null);
    }
  };
  const saveService = () => {
    try {
      if (!endpoint.trim()) throw new Error("Enter a translation endpoint.");
      useSubtitleTools.setState(
        validateSubtitleTools({
          ...preferences,
          translationEndpoint: endpoint,
        }),
      );
      setConfigure(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid endpoint.");
    }
  };
  return (
    <Menu.CardWithScrollable>
      <Menu.BackLink
        onClick={() => router.navigate("/captions")}
        rightSide={
          <button
            type="button"
            aria-label="Configure translation service"
            onClick={() => setConfigure(!configure)}
            className="tabbable p-2 rounded hover:bg-video-context-light/10"
          >
            <Icon icon={Icons.GEAR} />
          </button>
        }
      >
        Translate subtitles
      </Menu.BackLink>
      <Menu.Section className="!pt-1 mt-2 pb-3">
        {configure ? (
          <div className="space-y-4 pb-4">
            <p className="text-xs text-type-secondary">
              Use a LibreTranslate-compatible service to translate this text
              track.
            </p>
            <label className="block text-sm">
              Translate endpoint
              <input
                type="url"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://translate.example/translate"
                className="mt-2 w-full rounded bg-video-context-inputBg p-3 text-white tabbable"
              />
            </label>
            <label className="block text-sm">
              API key (optional)
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="mt-2 w-full rounded bg-video-context-inputBg p-3 text-white tabbable"
              />
            </label>
            <Button theme="secondary" onClick={saveService}>
              Choose language
            </Button>
            <p className="text-xs text-type-secondary">
              Only subtitle text is sent to this service. The API key stays in
              this panel.
            </p>
          </div>
        ) : (
          <>
            {original ? (
              <Menu.Link clickable onClick={restoreSubtitleTranslation}>
                Restore original
              </Menu.Link>
            ) : null}
            {progress !== null ? (
              <div className="space-y-2 py-3">
                <p
                  role="status"
                  className="text-sm text-video-context-type-accent"
                >
                  Translating to {subtitleLanguageName(target)} · {progress}%
                </p>
                <div className="h-1 rounded bg-video-context-light/10">
                  <div
                    className="h-full rounded bg-video-context-type-accent transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  type="button"
                  className="tabbable py-2 text-sm"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {!parsed.length ? (
              <p className="text-sm text-type-secondary py-3">
                Select a text subtitle track before translating.
              </p>
            ) : (
              languages
                .filter(
                  (language) =>
                    language !== (original?.language ?? caption?.language),
                )
                .map((language) => (
                  <Menu.SelectableLink
                    key={language}
                    selected={
                      Boolean(original) && caption?.language === language
                    }
                    disabled={progress !== null}
                    loading={progress !== null && target === language}
                    error={error && target === language ? error : undefined}
                    onClick={() => translate(language)}
                  >
                    {subtitleLanguageName(language)}
                  </Menu.SelectableLink>
                ))
            )}
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-type-danger py-3">
            {error}
          </p>
        ) : null}
      </Menu.Section>
    </Menu.CardWithScrollable>
  );
}
