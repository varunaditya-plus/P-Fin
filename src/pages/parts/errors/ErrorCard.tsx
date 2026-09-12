import { Dialog } from "@headlessui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon, Icons } from "@/components/Icon";
import { copyText } from "@/utils/copyText";
import { createErrorReport } from "@/utils/errorDebugInfo";

export function ErrorCard(props: {
  error: unknown;
  componentStack?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const report = useMemo(
    () => createErrorReport(props.error, props.componentStack),
    [props.error, props.componentStack],
  );
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    setCopyStatus("idle");
    return () => {
      alive.current = false;
      generation.current += 1;
      clearTimeout(timer.current);
    };
  }, [report]);
  const copy = async () => {
    setCopyStatus("copying");
    clearTimeout(timer.current);
    const currentGeneration = generation.current;
    const copied = await copyText(report);
    if (!alive.current || generation.current !== currentGeneration) return;
    setCopyStatus(copied ? "copied" : "failed");
    if (copied) timer.current = setTimeout(() => setCopyStatus("idle"), 3000);
  };
  return (
    <div className="bg-errors-card w-full min-w-0 rounded-xl p-4 sm:p-6 text-left">
      <div className="border-errors-border flex items-center justify-between gap-3 border-b pb-3">
        <h2 className="font-medium text-white">{t("errors.details")}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={
              copyStatus === "copied" ? "Copied" : "Copy error report"
            }
            disabled={copyStatus === "copying"}
            className="tabbable inline-flex items-center gap-2 rounded-lg bg-buttons-cancel p-2.5 text-white hover:bg-buttons-cancelHover disabled:opacity-50"
            onClick={copy}
          >
            <Icon
              icon={copyStatus === "copied" ? Icons.CHECKMARK : Icons.COPY}
            />
            <span className="hidden min-[400px]:inline">
              {copyStatus === "copied"
                ? t("actions.copied")
                : t("player.playbackError.copyDebugInfo")}
            </span>
          </button>
          <button
            type="button"
            aria-label="Close error details"
            className="tabbable rounded-lg bg-buttons-cancel p-2.5 text-white hover:bg-buttons-cancelHover"
            onClick={props.onClose}
          >
            <Icon icon={Icons.X} />
          </button>
        </div>
      </div>
      <pre
        tabIndex={0}
        aria-label="Error report"
        className="tabbable pointer-events-auto mt-4 max-h-[55dvh] min-h-40 select-text overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-left text-xs sm:text-sm"
      >
        {report}
      </pre>
      {copyStatus === "failed" ? (
        <p role="alert" className="mt-3 text-sm text-type-danger">
          Could not copy. Select the report above and copy it manually.
        </p>
      ) : (
        <span role="status" className="sr-only">
          {copyStatus === "copied" ? "Error report copied." : ""}
        </span>
      )}
      <p className="mt-4 text-sm text-type-secondary">
        Authentication tokens are removed. Review the report before sharing it.
      </p>
    </div>
  );
}

// This dialog is also used by the root error boundary, outside the router.
export function ErrorCardInPlainModal(props: {
  error?: unknown;
  componentStack?: string;
  onClose: () => void;
  show?: boolean;
}) {
  return (
    <Dialog
      open={Boolean(props.show)}
      onClose={props.onClose}
      className="relative z-[2000]"
      aria-label="Error details"
    >
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
        <Dialog.Panel className="w-full max-w-3xl min-w-0 max-h-[94dvh] overflow-y-auto rounded-xl shadow-2xl">
          <ErrorCard
            error={props.error}
            componentStack={props.componentStack}
            onClose={props.onClose}
          />
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
