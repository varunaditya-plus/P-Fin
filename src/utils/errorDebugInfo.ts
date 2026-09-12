import { detect } from "detect-browser";

import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePlayerStore } from "@/stores/player/store";

export interface ErrorDebugInfo {
  timestamp: string;
  error: {
    message: string;
    type: string;
    stackTrace?: string;
    componentStack?: string;
  };
  device: {
    userAgent: string;
    browser: string;
    os: string;
    isMobile: boolean;
    isTV: boolean;
    screenResolution: string;
    viewportSize: string;
  };
  player: {
    status: string;
    currentQuality: string | null;
    meta: {
      title: string;
      type: string;
      jellyfinItemId: string;
      jellyfinSeriesId?: string;
      releaseYear: number;
      season?: number;
      episode?: number;
    } | null;
  };
  network: {
    online: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  hls?: {
    details: string;
    fatal: boolean;
    level?: number;
    levelDetails?: {
      url: string;
      width: number;
      height: number;
      bitrate: number;
    };
    frag?: {
      url: string;
      baseurl: string;
      duration: number;
      start: number;
      sn: number;
    };
    type: string;
    url?: string;
  };
  url: {
    pathname: string;
    search: string;
    hash: string;
  };

  performance: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoadedEventEnd: number;
    };
  };
}

function read(value: unknown, key: string): unknown {
  try {
    return value && (typeof value === "object" || typeof value === "function")
      ? Reflect.get(value, key)
      : undefined;
  } catch {
    return undefined;
  }
}
function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
/** Remove authentication material before a report is displayed or copied. */
export function redactDiagnostics(value: string): string {
  let result = value
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(
      /([?&#](?:api[_-]?key|access[_-]?token|token|password|pw|secret|auth|authorization)=)[^&#\s"'<>]*/gi,
      "$1[redacted]",
    )
    .replace(
      /(\b(?:api[_-]?key|access[_-]?token|jellyfinAccessToken|token|password|pw|secret)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&}]+)/gi,
      "$1[redacted]",
    )
    .replace(/(\bAuthorization["']?\s*[:=]\s*)[^\r\n]*/gi, "$1[redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]");
  // Error messages sometimes embed a token without a field or URL parameter.
  try {
    const token = useJellyfinAuth.getState().session?.accessToken;
    if (token) {
      result = result.split(token).join("[redacted]");
      result = result.split(encodeURIComponent(token)).join("[redacted]");
    }
  } catch {
    // Reporting must remain usable when application state caused the failure.
  }
  return result;
}

export function errorMessage(error: unknown): string {
  const message = text(read(error, "message")) ?? text(read(error, "key"));
  if (message) return redactDiagnostics(message);
  try {
    return redactDiagnostics(
      typeof error === "string" ? error : String(error ?? "Unknown error"),
    );
  } catch {
    return "Unknown error";
  }
}

export function gatherErrorDebugInfo(
  error: unknown,
  componentStack?: string,
): ErrorDebugInfo {
  const browserInfo = detect();
  const playerStore = usePlayerStore.getState();
  const connection =
    read(navigator, "connection") ??
    read(navigator, "mozConnection") ??
    read(navigator, "webkitConnection");
  const performanceInfo = performance.getEntriesByType?.("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const memory = read(performance, "memory");
  const hls = read(error, "hls");
  const levelDetails = read(hls, "levelDetails");
  const frag = read(hls, "frag");
  const info: ErrorDebugInfo = {
    timestamp: new Date().toISOString(),
    error: {
      message: errorMessage(error),
      type: text(read(error, "type")) ?? text(read(error, "name")) ?? "unknown",
      stackTrace: text(read(error, "stackTrace")) ?? text(read(error, "stack")),
      componentStack,
    },
    device: {
      userAgent: navigator.userAgent,
      browser: browserInfo?.name || "unknown",
      os: browserInfo?.os || "unknown",
      isMobile: window.innerWidth <= 768,
      isTV: /SmartTV|Tizen|WebOS|SamsungBrowser|HbbTV|Viera|NetCast|AppleTV|Android TV|GoogleTV|Roku|PlayStation|Xbox|Opera TV|AquosBrowser|Hisense|SonyBrowser|SharpBrowser|AFT|Chromecast/i.test(
        navigator.userAgent,
      ),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    },
    player: {
      status: playerStore.status,
      currentQuality: playerStore.currentQuality,
      meta: playerStore.meta
        ? {
            title: playerStore.meta.title,
            type: playerStore.meta.type,
            jellyfinItemId: playerStore.meta.jellyfinItemId,
            jellyfinSeriesId: playerStore.meta.jellyfinSeriesId,
            releaseYear: playerStore.meta.releaseYear,
            season: playerStore.meta.season?.number,
            episode: playerStore.meta.episode?.number,
          }
        : null,
    },
    network: {
      online: navigator.onLine,
      connectionType: text(read(connection, "type")),
      effectiveType: text(read(connection, "effectiveType")),
      downlink: number(read(connection, "downlink")),
      rtt: number(read(connection, "rtt")),
    },
    hls: hls
      ? {
          details: text(read(hls, "details")) ?? "unknown",
          fatal: read(hls, "fatal") === true,
          level: number(read(hls, "level")),
          levelDetails: levelDetails
            ? {
                url: text(read(levelDetails, "url")) ?? "",
                width: number(read(levelDetails, "width")) ?? 0,
                height: number(read(levelDetails, "height")) ?? 0,
                bitrate: number(read(levelDetails, "bitrate")) ?? 0,
              }
            : undefined,
          frag: frag
            ? {
                url: text(read(frag, "url")) ?? "",
                baseurl: text(read(frag, "baseurl")) ?? "",
                duration: number(read(frag, "duration")) ?? 0,
                start: number(read(frag, "start")) ?? 0,
                sn: number(read(frag, "sn")) ?? 0,
              }
            : undefined,
          type: text(read(hls, "type")) ?? "unknown",
          url: text(read(hls, "url")),
        }
      : undefined,
    url: {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    },
    performance: {
      memory: memory
        ? {
            usedJSHeapSize: number(read(memory, "usedJSHeapSize")) ?? 0,
            totalJSHeapSize: number(read(memory, "totalJSHeapSize")) ?? 0,
            jsHeapSizeLimit: number(read(memory, "jsHeapSizeLimit")) ?? 0,
          }
        : undefined,
      timing: {
        navigationStart: performanceInfo?.fetchStart || 0,
        loadEventEnd: performanceInfo?.loadEventEnd || 0,
        domContentLoadedEventEnd:
          performanceInfo?.domContentLoadedEventEnd || 0,
      },
    },
  };
  // Apply redaction to every string, including nested HLS URLs and stacks.
  return JSON.parse(
    JSON.stringify(info, (_key, value) =>
      typeof value === "string" ? redactDiagnostics(value) : value,
    ),
  );
}

export function formatErrorDebugInfo(info: ErrorDebugInfo): string {
  const sections = [
    `=== ERROR DEBUG INFO ===`,
    `Timestamp: ${info.timestamp}`,
    ``,
    `=== ERROR DETAILS ===`,
    `Type: ${info.error.type}`,
    `Message: ${info.error.message}`,
    info.error.stackTrace ? `Stack Trace:\n${info.error.stackTrace}` : "",
    info.error.componentStack
      ? `Component Stack:\n${info.error.componentStack}`
      : "",
    ``,
    `=== DEVICE INFO ===`,
    `Browser: ${info.device.browser} (${info.device.os})`,
    `User Agent: ${info.device.userAgent}`,
    `Screen: ${info.device.screenResolution}`,
    `Viewport: ${info.device.viewportSize}`,
    `Mobile: ${info.device.isMobile}`,
    `TV: ${info.device.isTV}`,
    ``,
    `=== PLAYER STATE ===`,
    `Status: ${info.player.status}`,
    `Quality: ${info.player.currentQuality || "null"}`,
    info.player.meta
      ? [
          `Media: ${info.player.meta.title} (${info.player.meta.type})`,
          `Jellyfin item: ${info.player.meta.jellyfinItemId}`,
          info.player.meta.jellyfinSeriesId
            ? `Jellyfin series: ${info.player.meta.jellyfinSeriesId}`
            : "",
          `Year: ${info.player.meta.releaseYear}`,
          info.player.meta.season ? `Season: ${info.player.meta.season}` : "",
          info.player.meta.episode
            ? `Episode: ${info.player.meta.episode}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "No media loaded",
    ``,
    `=== NETWORK INFO ===`,
    `Online: ${info.network.online}`,
    info.network.connectionType
      ? `Connection Type: ${info.network.connectionType}`
      : "",
    info.network.effectiveType
      ? `Effective Type: ${info.network.effectiveType}`
      : "",
    info.network.downlink ? `Downlink: ${info.network.downlink} Mbps` : "",
    info.network.rtt ? `RTT: ${info.network.rtt} ms` : "",
    ``,
    `=== URL INFO ===`,
    `Path: ${info.url.pathname}`,
    info.url.search ? `Query: ${info.url.search}` : "",
    info.url.hash ? `Hash: ${info.url.hash}` : "",
    ``,
    info.hls
      ? [
          `=== HLS ERROR DETAILS ===`,
          `Details: ${info.hls.details}`,
          `Fatal: ${info.hls.fatal}`,
          `Type: ${info.hls.type}`,
          info.hls.level !== undefined ? `Level: ${info.hls.level}` : "",
          info.hls.url ? `URL: ${info.hls.url}` : "",
          info.hls.levelDetails
            ? [
                `Level Details:`,
                `  URL: ${info.hls.levelDetails.url}`,
                `  Resolution: ${info.hls.levelDetails.width}x${info.hls.levelDetails.height}`,
                `  Bitrate: ${info.hls.levelDetails.bitrate} bps`,
              ].join("\n")
            : "",
          info.hls.frag
            ? [
                `Fragment Details:`,
                `  URL: ${info.hls.frag.url}`,
                `  Base URL: ${info.hls.frag.baseurl}`,
                `  Duration: ${info.hls.frag.duration}s`,
                `  Start: ${info.hls.frag.start}s`,
                `  Sequence: ${info.hls.frag.sn}`,
              ].join("\n")
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    ``,
    `=== PERFORMANCE ===`,
    info.performance.memory
      ? [
          `Memory Used: ${Math.round(info.performance.memory.usedJSHeapSize / 1024 / 1024)} MB`,
          `Memory Total: ${Math.round(info.performance.memory.totalJSHeapSize / 1024 / 1024)} MB`,
          `Memory Limit: ${Math.round(info.performance.memory.jsHeapSizeLimit / 1024 / 1024)} MB`,
        ].join("\n")
      : "Memory info not available",
  ];

  return redactDiagnostics(sections.filter(Boolean).join("\n"));
}

export function createErrorReport(error: unknown, componentStack?: string) {
  try {
    return formatErrorDebugInfo(gatherErrorDebugInfo(error, componentStack));
  } catch {
    return redactDiagnostics(
      [
        "=== ERROR DETAILS ===",
        errorMessage(error),
        text(read(error, "stack")),
        componentStack ? `Component stack:\n${componentStack}` : undefined,
        "Additional diagnostics are unavailable.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}
