import { ReactNode } from "react";

import { Icon, Icons } from "@/components/Icon";
import { Flare } from "@/components/utils/Flare";
import { Heading2 } from "@/components/utils/Text";

import { Modal, useModal } from "./Modal";

export function KeyboardCommandsFrame({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const modal = useModal(id);
  return (
    <Modal id={id}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-0 flex items-center justify-center overflow-hidden p-4 pointer-events-none"
      >
        <Flare.Base className="group relative w-full max-w-7xl max-h-[85dvh] overflow-y-auto rounded-3xl bg-mediaCard-hoverBackground/60 p-6 shadow-lg backdrop-blur-lg pointer-events-auto">
          <Flare.Light
            flareSize={300}
            cssColorVar="--colors-mediaCard-hoverAccent"
            backgroundClass="bg-modal-background duration-100"
            className="rounded-3xl bg-background-main group-hover:opacity-100"
          />
          <Flare.Child className="relative pointer-events-auto min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <Heading2 className="!my-0 pr-6">{title}</Heading2>
              <button
                type="button"
                onClick={modal.hide}
                aria-label="Close keyboard shortcuts"
                className="tabbable shrink-0 rounded-full p-2 transition-colors hover:bg-video-context-light/20"
              >
                <Icon icon={Icons.X} />
              </button>
            </div>
            {children}
          </Flare.Child>
        </Flare.Base>
      </div>
    </Modal>
  );
}
