import { useLayoutEffect, useRef, useState } from "react";

export function ExpandableBiography({ text }: { text: string }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () =>
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  return (
    <div className="mt-3">
      <p
        ref={paragraph}
        className={`whitespace-pre-line text-sm text-type-text leading-relaxed ${expanded ? "" : "line-clamp-6"}`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          className="tabbable mt-2 text-sm text-type-link"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
