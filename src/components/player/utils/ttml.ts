import { ContentCaption } from "subsrt-ts/dist/types/handler";

export interface TimedTextCue extends ContentCaption {
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    align: "start" | "center" | "end";
  };
  style?: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    textAlign?: "left" | "right" | "center";
    fontFamily?: string;
    opacity?: number;
    textShadow?: string;
  };
}
const stylingNamespace = "http://www.w3.org/ns/ttml#styling";
const parameterNamespace = "http://www.w3.org/ns/ttml#parameter";
const attrs = (element: Element, name: string) =>
  element.getAttributeNS(stylingNamespace, name) ??
  element.getAttribute(`tts:${name}`);
const elements = (root: ParentNode, name: string) =>
  Array.from(root.querySelectorAll("*")).filter(
    (element) => element.localName === name,
  );
export const isTTML = (text: string) =>
  /<(?:[\w-]+:)?tt(?:\s|>)/.test(text.slice(0, 4096));

export function timedTextTime(
  value: string | null,
  frameRate = 30,
  tickRate = 1,
): number | null {
  if (!value) return null;
  const units = value.trim().match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/);
  if (units)
    return (
      Number(units[1]) *
      ({
        h: 3600000,
        m: 60000,
        s: 1000,
        ms: 1,
        f: 1000 / frameRate,
        t: 1000 / tickRate,
      }[units[2]] ?? 1)
    );
  const clock = value.match(/^(\d+):(\d{2}):(\d{2})(?:[.,](\d+)|:(\d+))?$/);
  if (!clock) return null;
  return (
    (Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])) *
      1000 +
    (clock[4] ? Number(`0.${clock[4]}`) * 1000 : 0) +
    (Number(clock[5] ?? 0) / frameRate) * 1000
  );
}

function colour(value: string | null) {
  if (!value || /[;{}<>"']/.test(value)) return undefined;
  const probe = document.createElement("span");
  probe.style.color = value;
  return probe.style.color || undefined;
}
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function pair(value: string | null): [number, number] | undefined {
  const match = value?.match(/^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/);
  return match
    ? [Math.min(100, Number(match[1])), Math.min(100, Number(match[2]))]
    : undefined;
}

/** Parse a conservative TTML subset; generated markup contains only validated text styles. */
export function parseTTML(xml: string): TimedTextCue[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Unsupported subtitle document declarations.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror"))
    throw new Error("The TTML subtitle is malformed.");
  const root = doc.documentElement;
  const param = (key: string) =>
    root.getAttributeNS(parameterNamespace, key) ??
    root.getAttribute(`ttp:${key}`);
  const frameRate = Math.max(1, Number(param("frameRate")) || 30);
  const tickRate = Math.max(1, Number(param("tickRate")) || 1);
  const time = (value: string | null) =>
    timedTextTime(value, frameRate, tickRate);
  const styles = new Map(
    elements(doc, "style").map((element) => [
      element.getAttribute("xml:id") ?? element.getAttribute("id"),
      element,
    ]),
  );
  type Style = NonNullable<TimedTextCue["style"]>;
  function readStyle(element: Element, seen = new Set<Element>()): Style {
    if (seen.has(element)) return {};
    seen.add(element);
    const result: Style = {};
    for (const ref of (element.getAttribute("style") ?? "").split(/\s+/)) {
      const named = styles.get(ref);
      if (named) Object.assign(result, readStyle(named, seen));
    }
    const fg = colour(attrs(element, "color"));
    const bg = colour(attrs(element, "backgroundColor"));
    if (fg) result.color = fg;
    if (bg) result.backgroundColor = bg;
    const weight = attrs(element, "fontWeight");
    if (weight === "bold" || weight === "normal") result.fontWeight = weight;
    const italic = attrs(element, "fontStyle");
    if (italic === "italic" || italic === "normal") result.fontStyle = italic;
    const align = attrs(element, "textAlign");
    if (["left", "right", "center", "start", "end"].includes(align ?? ""))
      result.textAlign = (
        align === "start" ? "left" : align === "end" ? "right" : align
      ) as Style["textAlign"];
    const family = attrs(element, "fontFamily");
    if (family)
      result.fontFamily = /mono/i.test(family)
        ? "monospace"
        : /^(serif|proportionalSerif)$/.test(family)
          ? "serif"
          : "sans-serif";
    const opacity = attrs(element, "opacity");
    if (opacity !== null && Number.isFinite(Number(opacity)))
      result.opacity = Math.min(1, Math.max(0, Number(opacity)));
    const outline = attrs(element, "textOutline")?.match(
      /^(\S+)\s+([\d.]+)px$/,
    );
    if (outline && colour(outline[1])) {
      const width = Math.min(10, Number(outline[2]));
      result.textShadow = `${width}px 0 ${colour(outline[1])}, -${width}px 0 ${colour(outline[1])}, 0 ${width}px ${colour(outline[1])}, 0 -${width}px ${colour(outline[1])}`;
    }
    return result;
  }
  function html(node: Node): string {
    if (node.nodeType === 3) return escape(node.textContent ?? "");
    if (node.nodeType !== 1) return "";
    const element = node as Element;
    if (element.localName === "br") return "<br />";
    const inner = Array.from(element.childNodes).map(html).join("");
    if (element.localName !== "span") return inner;
    const style = readStyle(element);
    const css = Object.entries(style)
      .map(
        ([key, value]) =>
          `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`,
      )
      .join(";");
    return css ? `<span style="${escape(css)}">${inner}</span>` : inner;
  }
  const regions = new Map(
    elements(doc, "region").map((region) => [
      region.getAttribute("xml:id") ?? region.getAttribute("id"),
      region,
    ]),
  );
  const cues: TimedTextCue[] = [];
  for (const paragraph of elements(doc, "p")) {
    const ancestors: Element[] = [];
    let node: Element | null = paragraph;
    while (node) {
      ancestors.unshift(node);
      node = node.parentElement;
    }
    let start = 0;
    let end = Infinity;
    let regionId: string | null = null;
    let style: Style = {};
    for (const ancestor of ancestors) {
      const begin = time(ancestor.getAttribute("begin")) ?? 0;
      const finish = time(ancestor.getAttribute("end"));
      const duration = time(ancestor.getAttribute("dur"));
      const parentStart = start;
      start += begin;
      end = Math.min(
        end,
        finish === null ? Infinity : parentStart + finish,
        duration === null ? Infinity : start + duration,
      );
      regionId = ancestor.getAttribute("region") ?? regionId;
      style = { ...style, ...readStyle(ancestor) };
    }
    if (!Number.isFinite(end) || end <= start) continue;
    const region = regionId ? regions.get(regionId) : undefined;
    const origin = region ? pair(attrs(region, "origin")) : undefined;
    const extent = region ? pair(attrs(region, "extent")) : undefined;
    const content = Array.from(paragraph.childNodes).map(html).join("").trim();
    const text =
      new DOMParser().parseFromString(
        content.replace(/<br\s*\/?\s*>/gi, "\n"),
        "text/html",
      ).body.textContent ?? "";
    if (!text.trim()) continue;
    cues.push({
      type: "caption",
      index: cues.length + 1,
      start,
      end,
      duration: end - start,
      content,
      text,
      style: { ...(region ? readStyle(region) : {}), ...style },
      region:
        origin && extent
          ? {
              x: origin[0],
              y: origin[1],
              width: Math.min(extent[0], 100 - origin[0]),
              height: Math.min(extent[1], 100 - origin[1]),
              align:
                attrs(region!, "displayAlign") === "before"
                  ? "start"
                  : attrs(region!, "displayAlign") === "center"
                    ? "center"
                    : "end",
            }
          : undefined,
    });
  }
  if (!cues.length)
    throw new Error("No supported timed subtitle cues were found.");
  return cues.sort((a, b) => a.start - b.start);
}

export function timedTextToSrt(cues: TimedTextCue[]) {
  const stamp = (value: number) => {
    const ms = Math.max(0, Math.round(value));
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`,
    )
    .join("\n");
}
