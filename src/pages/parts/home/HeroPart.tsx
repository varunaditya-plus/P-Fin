import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import { SearchBarInput } from "@/components/form/SearchBar";
import { ThinContainer } from "@/components/layout/ThinContainer";
import { useSlashFocus } from "@/components/player/hooks/useSlashFocus";
import { HeroTitle } from "@/components/text/HeroTitle";
import { useIsIOS, useIsMobile, useIsPWA } from "@/hooks/useIsMobile";
import { useIsTV } from "@/hooks/useIsTv";
import { useRandomTranslation } from "@/hooks/useRandomTranslation";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { useBannerSize } from "@/stores/banner";

import { DiscoverShortcut } from "./DiscoverShortcut";

export interface HeroPartProps {
  setIsSticky: (val: boolean) => void;
  searchParams: ReturnType<typeof useSearchQuery>;
  showTitle?: boolean;
  isInFeatured?: boolean;
}

function getTimeOfDay(
  date: Date,
): "night" | "morning" | "day" | "420" | "69" | "halloween" {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 4 && day === 20) return "420";
  if (month === 6 && day === 9) return "69";
  if (month === 10 && day === 31) return "halloween";
  const hour = date.getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 19) return "day";
  return "night";
}

export function HeroPart({
  setIsSticky,
  searchParams,
  showTitle,
  isInFeatured,
}: HeroPartProps) {
  const { t: randomT } = useRandomTranslation();
  const [search, setSearch, setSearchUnFocus] = searchParams;
  const [showBg, setShowBg] = useState(false);
  const bannerSize = useBannerSize();
  const { isMobile } = useIsMobile();
  const { isTV } = useIsTV();

  const isPWA = useIsPWA();
  const isIOS = useIsIOS();
  const isIOSPWA = isIOS && isPWA;

  // Navbar height is 80px (h-20)
  const navbarHeight = 80;
  // On desktop: inline with navbar (same top position + 14px adjustment)
  // On mobile: below navbar (navbar height + banner)
  const topOffset = isMobile
    ? navbarHeight + bannerSize + (isIOSPWA ? 34 : 0)
    : bannerSize + 14;

  const stickyHolder = useRef<HTMLDivElement>(null);
  const [fixedPosition, setFixedPosition] = useState<{
    left: number;
    width: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    const holder = stickyHolder.current;
    if (!holder) return;
    const updatePosition = () => {
      const rect = holder.getBoundingClientRect();
      const fixed = rect.top < topOffset;
      setShowBg(fixed);
      setIsSticky(fixed);
      setFixedPosition((previous) => {
        if (!fixed) return null;
        const leftNav = document
          .querySelector('[data-navigation-cluster="left"]')
          ?.getBoundingClientRect();
        const rightNav = document
          .querySelector('[data-navigation-cluster="right"]')
          ?.getBoundingClientRect();
        const leftEdge = (leftNav?.right ?? 0) + 16;
        const rightEdge = (rightNav?.left ?? window.innerWidth) - 16;
        const inline = !isMobile && rightEdge - leftEdge >= 360;
        const width = inline
          ? Math.min(rect.width, rightEdge - leftEdge)
          : rect.width;
        const left = inline
          ? Math.max(leftEdge, Math.min(rect.left, rightEdge - width))
          : rect.left;
        const top =
          !isMobile && !inline ? navbarHeight + bannerSize + 8 : topOffset;
        if (
          previous?.left === left &&
          previous.width === width &&
          previous.top === top
        )
          return previous;
        return { left, width, top };
      });
    };
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(holder);
    document
      .querySelectorAll("[data-navigation-cluster]")
      .forEach((cluster) => resizeObserver.observe(cluster));
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    updatePosition();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [topOffset, setIsSticky, showTitle, isInFeatured, isMobile, bannerSize]);

  const time = getTimeOfDay(new Date());
  const title = randomT(`home.titles.${time}`);
  const placeholder = randomT(`home.search.placeholder`);
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashFocus(inputRef);

  return (
    <ThinContainer>
      <div
        className={classNames(
          "space-y-16 text-center",
          showTitle ? "mt-44" : "mt-4",
        )}
      >
        {showTitle && (!isTV || search.length === 0) ? (
          <div className="relative z-10 mb-16">
            <HeroTitle className="mx-auto max-w-md">{title}</HeroTitle>
          </div>
        ) : null}

        <div ref={stickyHolder} className="relative h-20 z-30">
          <div
            style={
              fixedPosition
                ? {
                    position: "fixed",
                    top: 0,
                    left: fixedPosition.left,
                    width: fixedPosition.width,
                    paddingTop: fixedPosition.top,
                    transform: "translateZ(0)",
                  }
                : undefined
            }
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <SearchBarInput
                  ref={inputRef}
                  onChange={setSearch}
                  value={search}
                  onUnFocus={setSearchUnFocus}
                  placeholder={placeholder ?? ""}
                  isSticky={showBg}
                  isInFeatured={isInFeatured}
                  hideTooltip
                />
              </div>
              <DiscoverShortcut query={search} />
            </div>
          </div>
        </div>
      </div>
    </ThinContainer>
  );
}
