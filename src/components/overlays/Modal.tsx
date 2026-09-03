import classNames from "classnames";
import { ReactNode, useCallback } from "react";
import { Helmet } from "react-helmet-async";

import { OverlayPortal } from "@/components/overlays/OverlayDisplay";
import { useOverlayStack } from "@/stores/interface/overlayStack";

export function useModal(id: string) {
  const { showModal, hideModal, isModalVisible } = useOverlayStack();
  const show = useCallback(() => showModal(id), [id, showModal]);
  const hide = useCallback(() => hideModal(id), [id, hideModal]);
  return {
    id,
    isShown: isModalVisible(id),
    show,
    hide,
  };
}

export function ModalCard(props: {
  children?: ReactNode;
  className?: ReactNode;
}) {
  return (
    <div
      className={classNames(
        "w-full max-w-[30rem] m-4 pointer-events-auto",
        props.className,
      )}
    >
      <div className="w-full bg-modal-background rounded-xl p-8">
        {props.children}
      </div>
    </div>
  );
}

export function Modal(props: { id: string; children?: ReactNode }) {
  const modal = useModal(props.id);
  const { modalStack } = useOverlayStack();
  const modalIndex = modalStack.indexOf(props.id);
  const zIndex = modalIndex >= 0 ? 1000 + modalIndex : 999;

  return (
    <OverlayPortal
      darken
      close={modal.hide}
      show={modal.isShown}
      zIndex={zIndex}
    >
      <Helmet>
        <html data-no-scroll />
      </Helmet>
      <div className="flex absolute inset-0 items-center justify-center flex-col pointer-events-none">
        {props.children}
      </div>
    </OverlayPortal>
  );
}
