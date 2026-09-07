import { Link, useLocation } from "react-router-dom";

import { Icon, Icons } from "@/components/Icon";

export function MobileNavigation() {
  const location = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-[500] flex border-t border-white/10 bg-background-main/95 px-4 pt-2 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {[
        {
          path: "/",
          label: "Library",
          icon: Icons.EPISODES,
          active:
            location.pathname === "/" ||
            location.pathname.startsWith("/browse/"),
        },
        {
          path: "/discover",
          label: "Discover",
          icon: Icons.RISING_STAR,
          active: location.pathname === "/discover",
        },
        {
          path: "/settings",
          label: "Settings",
          icon: Icons.SETTINGS,
          active: location.pathname.startsWith("/settings"),
        },
      ].map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => window.scrollTo(0, 0)}
          aria-current={item.active ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs tabbable ${item.active ? "text-type-link" : "text-type-secondary"}`}
        >
          <Icon icon={item.icon} className="text-xl" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
