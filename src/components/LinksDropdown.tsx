import classNames from "classnames";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { logoutJellyfin } from "@/backend/jellyfin/client";
import { logoutSeerr } from "@/backend/seerr/api";
import { Icon, Icons } from "@/components/Icon";
import { Transition } from "@/components/utils/Transition";
import { useJellyfinAuth } from "@/stores/jellyfin";

export function LinksDropdown({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const session = useJellyfinAuth((state) => state.session);
  const itemClass =
    "tabbable cursor-pointer flex gap-3 items-center m-3 p-1 rounded font-medium transition-colors duration-100 text-dropdown-text hover:text-white";
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);
  async function logout() {
    setOpen(false);
    await Promise.allSettled([logoutSeerr(), logoutJellyfin()]);
  }
  return (
    <div ref={containerRef} className="relative is-dropdown">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={classNames(
          "cursor-pointer tabbable rounded-full flex gap-2 text-white items-center py-2 px-3 bg-pill-background hover:bg-pill-backgroundHover backdrop-blur-lg transition-all duration-100 hover:scale-105",
          open ? "bg-opacity-100" : "bg-opacity-50",
        )}
      >
        {children}
        <Icon
          className={classNames(
            "text-xl transition-transform duration-100",
            open && "rotate-180",
          )}
          icon={Icons.CHEVRON_DOWN}
        />
      </button>
      <Transition animation="slide-down" show={open}>
        <div className="rounded-xl absolute w-64 bg-dropdown-altBackground top-full mt-3 right-0">
          {session ? (
            <>
              <div className="m-3 p-1 font-medium text-white">
                {session.userName}
              </div>
              <hr className="border-0 w-full h-px bg-dropdown-border" />
              {[
                { to: "/", title: "Library", icon: Icons.SEARCH },
                { to: "/discover", title: "Discover", icon: Icons.RISING_STAR },
                { to: "/settings", title: "Settings", icon: Icons.SETTINGS },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    window.scrollTo(0, 0);
                  }}
                >
                  <Icon icon={item.icon} className="text-xl" />
                  {item.title}
                </Link>
              ))}
              <button
                type="button"
                className={`${itemClass} !text-type-danger`}
                onClick={logout}
              >
                <Icon icon={Icons.LOGOUT} className="text-xl" />
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Sign in to Jellyfin
            </Link>
          )}
        </div>
      </Transition>
    </div>
  );
}
