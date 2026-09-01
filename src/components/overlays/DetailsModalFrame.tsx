import { Dialog, Transition } from "@headlessui/react";
import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet-async";

/** Keep the final content mounted until its exit transition has finished. */
export function useRetainedModalValue<T>(value: T | null | undefined) {
  const [retained, setRetained] = useState<T | undefined>(value ?? undefined);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (value !== null && value !== undefined) setRetained(value);
  }, [value]);
  const afterLeave = useCallback(() => {
    if (latest.current === null || latest.current === undefined)
      setRetained(undefined);
  }, []);
  return {
    value: value ?? retained,
    open: value !== null && value !== undefined,
    afterLeave,
  };
}

/** The original P-Stream detail motion, with a complete dialog lifecycle. */
export function DetailsModalFrame({
  open,
  onClose,
  afterLeave,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  afterLeave: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Transition appear show={open} as={Fragment} afterLeave={afterLeave}>
      <Dialog
        as="div"
        onClose={onClose}
        aria-label={label}
        className="relative z-[1000]"
        data-details-modal-layer
      >
        <Helmet>
          <html data-no-scroll />
        </Helmet>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-200 motion-reduce:transition-none"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-200 motion-reduce:transition-none"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        </Transition.Child>
        <Transition.Child
          as={Fragment}
          enter="transition-[transform,opacity] duration-500 motion-reduce:transition-none"
          enterFrom="opacity-0 translate-y-4 motion-reduce:translate-y-0"
          enterTo="opacity-100 translate-y-0"
          leave="transition-[transform,opacity] duration-500 motion-reduce:transition-none"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-4 motion-reduce:translate-y-0"
        >
          <div
            className="fixed inset-0 pointer-events-none"
            data-details-modal-motion
          >
            <Dialog.Panel className="contents" data-details-modal-panel>
              {children}
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
