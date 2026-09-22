import { Icon, Icons } from "@/components/Icon";
import { Flare } from "@/components/utils/Flare";

interface CarouselNavButtonsProps {
  categorySlug: string;
  carouselRefs: React.MutableRefObject<{
    [key: string]: HTMLDivElement | null;
  }>;
}

interface NavButtonProps {
  direction: "left" | "right";
  onClick: () => void;
}

function NavButton({ direction, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Previous items" : "Next items"}
      className={`absolute ${direction === "left" ? "left-12" : "right-12"} top-1/2 transform -translate-y-3/4 z-10`}
      onClick={onClick}
    >
      <Flare.Base className="group -m-[0.705em] rounded-full bg-search-hoverBackground transition-transform duration-300 focus:relative focus:z-10 hover:bg-mediaCard-hoverBackground tabbable hover:scale-110">
        <Flare.Light
          flareSize={90}
          cssColorVar="--colors-mediaCard-hoverAccent"
          backgroundClass="bg-mediaCard-hoverBackground duration-100"
          className="rounded-full group-hover:opacity-100 z-20"
        />
        <Flare.Child className="cursor-pointer text-white flex justify-center items-center h-10 w-10 rounded-full active:scale-110 transition-[transform,background-color] duration-200 z-30">
          <Icon
            icon={
              direction === "left" ? Icons.CHEVRON_LEFT : Icons.CHEVRON_RIGHT
            }
          />
        </Flare.Child>
      </Flare.Base>
    </button>
  );
}

export function CarouselNavButtons({
  categorySlug,
  carouselRefs,
}: CarouselNavButtonsProps) {
  const handleScroll = (direction: "left" | "right") => {
    const carousel = carouselRefs.current[categorySlug];
    if (!carousel) return;

    requestAnimationFrame(() => {
      // Cards can be anchors, person/trailer buttons, or wrappers around either.
      // Measure direct card children so decorative spacers and overlay arrows
      // cannot become the paging unit.
      const card = Array.from(carousel.children).find(
        (child) =>
          (child.matches("a, button, [role=button]") ||
            child.querySelector("a, button, [role=button]")) &&
          child.getBoundingClientRect().width > 0,
      );
      if (!card) return;
      const cardWidth = card.getBoundingClientRect().width;
      const carouselWidth = carousel.getBoundingClientRect().width;
      if (!cardWidth || !carouselWidth) return;
      const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0;
      const stride = cardWidth + gap;
      const visibleCards = Math.floor(carouselWidth / stride);
      const scrollAmount = stride * (visibleCards > 5 ? 4 : 2);
      carousel.scrollTo({
        left:
          carousel.scrollLeft +
          (direction === "left" ? -scrollAmount : scrollAmount),
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
      });
    });
  };

  return (
    <>
      <NavButton direction="left" onClick={() => handleScroll("left")} />
      <NavButton direction="right" onClick={() => handleScroll("right")} />
    </>
  );
}
