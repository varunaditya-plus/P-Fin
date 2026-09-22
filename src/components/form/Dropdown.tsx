import { Listbox } from "@headlessui/react";
import React, { Fragment, useLayoutEffect, useRef, useState } from "react";

import { Icon, Icons } from "@/components/Icon";
import { Transition } from "@/components/utils/Transition";

import { dropdownPlacement } from "./dropdownPlacement";

export interface OptionItem {
  id: string;
  name: string;
  leftIcon?: React.ReactNode;
}

interface DropdownProps {
  selectedItem: OptionItem;
  setSelectedItem: (value: OptionItem) => void;
  options: Array<OptionItem>;
  direction?: "up" | "down";
  side?: "left" | "right";
  customButton?: React.ReactNode;
  customMenu?: React.ReactNode;
  className?: string;
  preventWrap?: boolean;
}

function DropdownMenu({
  open,
  direction,
  side,
  children,
}: {
  open: boolean;
  direction: "up" | "down";
  side: "left" | "right";
  children: React.ReactNode;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({
    direction,
    left: 0,
    maxHeight: 240,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const anchor = marker.current?.parentElement;
      if (!anchor) return;
      setPlacement(
        dropdownPlacement(
          anchor.getBoundingClientRect(),
          menu.current?.scrollWidth ?? anchor.offsetWidth,
          { width: window.innerWidth, height: window.innerHeight },
          direction,
          side,
        ),
      );
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, direction, side]);
  return (
    <>
      <div ref={marker} />
      <Transition
        animation={placement.direction === "up" ? "slide-up" : "slide-down"}
        show={open}
        style={{
          left: placement.left,
          maxHeight: placement.maxHeight,
          maxWidth: "calc(100vw - 16px)",
        }}
        className={`absolute z-[40] min-w-[20px] w-max overflow-auto rounded-xl bg-dropdown-background py-1 text-white shadow-lg ring-1 ring-black ring-opacity-5 scrollbar-thin scrollbar-track-background-secondary scrollbar-thumb-type-secondary focus:outline-none ${placement.direction === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}
      >
        <div ref={menu}>{children}</div>
      </Transition>
    </>
  );
}

export function Dropdown(props: DropdownProps) {
  const { direction = "down", customButton, customMenu } = props;

  return (
    <div className={`relative my-4 w-fit max-w-[25rem] ${props.className}`}>
      <Listbox
        by="id"
        value={props.selectedItem}
        onChange={props.setSelectedItem}
      >
        {({ open }) => (
          <>
            {customButton ? (
              <Listbox.Button as={Fragment}>{customButton}</Listbox.Button>
            ) : (
              <Listbox.Button className="relative z-[30] w-full rounded-xl bg-dropdown-background hover:bg-dropdown-hoverBackground py-2 pl-3 pr-10 text-left text-white shadow-md focus:outline-none tabbable cursor-pointer">
                <span className="flex gap-4 items-center truncate">
                  {props.selectedItem.leftIcon
                    ? props.selectedItem.leftIcon
                    : null}
                  {props.selectedItem.name}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <Icon
                    icon={Icons.UP_DOWN_ARROW}
                    className={`transform transition-transform text-xl text-dropdown-secondary ${direction === "up" ? "rotate-180" : ""}`}
                  />
                </span>
              </Listbox.Button>
            )}
            <DropdownMenu
              open={open}
              direction={direction}
              side={props.side ?? "left"}
            >
              {customMenu ? (
                <Listbox.Options static as={Fragment}>
                  {customMenu}
                </Listbox.Options>
              ) : (
                <Listbox.Options static>
                  {props.options.map((opt) => (
                    <Listbox.Option
                      className={({ active }) =>
                        `cursor-pointer flex gap-4 items-center relative select-none py-2 px-4 mx-1 rounded-lg ${
                          active
                            ? "bg-background-secondaryHover text-type-link"
                            : "text-type-secondary"
                        } ${props.preventWrap ? "whitespace-nowrap" : ""}`
                      }
                      key={opt.id}
                      value={opt}
                    >
                      {opt.leftIcon ? opt.leftIcon : null}
                      {opt.name}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              )}
            </DropdownMenu>
          </>
        )}
      </Listbox>
    </div>
  );
}
