import classNames from "classnames";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { NoUserAvatar } from "@/components/Avatar";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { LinksDropdown } from "@/components/LinksDropdown";
import { Lightbar } from "@/components/utils/Lightbar";
import { BlurEllipsis } from "@/pages/layouts/SubPageLayout";
import { useBannerSize } from "@/stores/banner";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePreferencesStore } from "@/stores/preferences";

import { BrandPill } from "./BrandPill";
import { MobileNavigation } from "./MobileNavigation";

export interface NavigationProps {
  bg?: boolean;
  noLightbar?: boolean;
  doBackground?: boolean;
  clearBackground?: boolean;
  hideMobileNavigation?: boolean;
}

export function Navigation(props: NavigationProps) {
  const bannerHeight = useBannerSize();
  const location = useLocation();
  const session = useJellyfinAuth((state) => state.session);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate mask length based on scroll position
  const getMaskLength = () => {
    // When at top (0), use longer mask (200px)
    // When scrolled down (300px+), use shorter mask (100px)
    const maxScroll = 300;
    const minLength = 100;
    const maxLength = 180;
    const scrollFactor = Math.min(scrollPosition, maxScroll) / maxScroll;
    return minLength + (maxLength - minLength) * (1 - scrollFactor);
  };

  const enableLowPerformanceMode = usePreferencesStore(
    (s) => s.enableLowPerformanceMode,
  );

  return (
    <>
      {/* lightbar */}
      {!props.noLightbar ? (
        <div
          className="absolute inset-x-0 top-0 flex h-[88px] items-center justify-center"
          style={{
            top: `${bannerHeight}px`,
          }}
        >
          <div className="absolute inset-x-0 -mt-[22%] flex items-center sm:mt-0">
            <Lightbar noParticles={enableLowPerformanceMode} />
          </div>
        </div>
      ) : null}

      {/* backgrounds - these are seperate because of z-index issues */}
      <div
        className="top-content fixed z-[20] pointer-events-none left-0 right-0 top-0 min-h-[150px]"
        style={{
          top: `${bannerHeight}px`,
        }}
      >
        <div
          className={classNames(
            "fixed left-0 right-0 top-0 flex items-center", // border-b border-utils-divider border-opacity-50
            "transition-[background-color,backdrop-filter] duration-300 ease-in-out",
            props.doBackground
              ? props.clearBackground
                ? "backdrop-blur-md bg-transparent"
                : "bg-background-main"
              : "bg-transparent",
          )}
        >
          {props.doBackground ? (
            <div className="absolute w-full h-full inset-0 overflow-hidden">
              <BlurEllipsis positionClass="absolute" />
            </div>
          ) : null}
          <div className="opacity-0 absolute inset-0 block h-20 pointer-events-auto" />
          <div
            className={classNames(
              "transition-[background-color,backdrop-filter,opacity] duration-300 ease-in-out",
              props.bg ? "opacity-100" : "opacity-0",
              "absolute inset-0 block h-[11rem]",
              props.clearBackground
                ? "backdrop-blur-md bg-transparent"
                : "bg-background-main",
            )}
            style={{
              maskImage: `linear-gradient(
                to bottom,
                rgba(0, 0, 0, 1),
                rgba(0, 0, 0, 1) calc(100% - ${getMaskLength()}px),
                rgba(0, 0, 0, 0) 100%
              )`,
              WebkitMaskImage: `linear-gradient(
                to bottom,
                rgba(0, 0, 0, 1),
                rgba(0, 0, 0, 1) calc(100% - ${getMaskLength()}px),
                rgba(0, 0, 0, 0) 100%
              )`,
            }}
          />
        </div>
      </div>

      {/* content */}
      <div
        className="top-content fixed pointer-events-none left-0 right-0 z-[500] top-0 min-h-[150px]"
        style={{
          top: `${bannerHeight}px`,
        }}
      >
        <div className={classNames("fixed left-0 right-0 flex items-center")}>
          <div className="px-7 py-5 relative z-[60] flex flex-1 items-center justify-between">
            <div
              data-navigation-cluster="left"
              className="flex items-center space-x-1.5 ssm:space-x-3 pointer-events-auto"
            >
              <Link
                className="block tabbable rounded-full text-xs ssm:text-base"
                to="/"
                onClick={() => window.scrollTo(0, 0)}
              >
                <BrandPill clickable header />
              </Link>
              {session ? (
                <>
                  <Link
                    to="/"
                    aria-label="Library"
                    title="Library"
                    onClick={() => window.scrollTo(0, 0)}
                    className="text-xl text-white tabbable rounded-full backdrop-blur-lg"
                  >
                    <IconPatch
                      icon={Icons.SEARCH}
                      clickable
                      downsized
                      navigation
                    />
                  </Link>
                  <Link
                    to="/discover"
                    aria-label="Discover"
                    title="Discover"
                    onClick={() => window.scrollTo(0, 0)}
                    aria-current={
                      location.pathname === "/discover" ? "page" : undefined
                    }
                    className="text-xl text-white tabbable rounded-full backdrop-blur-lg"
                  >
                    <IconPatch
                      icon={Icons.RISING_STAR}
                      clickable
                      downsized
                      navigation
                    />
                  </Link>
                </>
              ) : null}
            </div>
            <div
              data-navigation-cluster="right"
              className="relative pointer-events-auto"
            >
              <LinksDropdown>
                <NoUserAvatar />
                {session ? (
                  <span className="hidden md:inline-block">
                    {session.userName}
                  </span>
                ) : null}
              </LinksDropdown>
            </div>
          </div>
        </div>
      </div>
      {session && !props.hideMobileNavigation ? <MobileNavigation /> : null}
    </>
  );
}
