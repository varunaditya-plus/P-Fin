import { ChangeEventHandler, useRef } from "react";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";

export function SettingsFilePicker({
  label,
  accept,
  fileName,
  disabled,
  onChange,
}: {
  label: string;
  accept: string;
  fileName?: string;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <input
        ref={input}
        aria-label={label}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={onChange}
      />
      <Button
        theme="secondary"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="inline-flex items-center justify-center gap-2 sm:min-w-[12rem]"
      >
        <Icon icon={Icons.DOWNLOAD} className="rotate-180" />
        {fileName ? "Change file" : "Select file"}
      </Button>
      {fileName ? (
        <span
          className="max-w-full truncate text-xs text-type-secondary"
          title={fileName}
        >
          {fileName}
        </span>
      ) : null}
    </div>
  );
}
