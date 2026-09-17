import { useEffect, useState } from "react";

import { Navigation } from "@/components/layout/Navigation";

export function HomeLayout(props: {
  showBg: boolean;
  hasFeaturedBackdrop: boolean;
  children: React.ReactNode;
}) {
  const [clearBackground, setClearBackground] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setClearBackground(props.hasFeaturedBackdrop && window.scrollY < 600);
    };
    window.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [props.hasFeaturedBackdrop]);

  return (
    <div className="min-h-screen">
      <Navigation
        hideMobileNavigation
        lightbarAtTop
        bg={props.hasFeaturedBackdrop || props.showBg}
        clearBackground={clearBackground}
        noLightbar={props.hasFeaturedBackdrop}
      />
      {props.children}
    </div>
  );
}
