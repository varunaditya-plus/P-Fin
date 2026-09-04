import http from "node:http";
import https from "node:https";

const HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-seerr-upstream",
];

export function resolveSeerrTarget(header, fallback) {
  const candidate =
    typeof header === "string" && header.trim() ? header.trim() : fallback;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    url = new URL(fallback);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    url = new URL(fallback);
  }
  url.hash = "";
  url.search = "";
  url.username = "";
  url.password = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

export function seerrUpstreamPath(target, requestUrl) {
  const incoming = requestUrl || "/";
  const queryIndex = incoming.indexOf("?");
  const pathOnly = queryIndex === -1 ? incoming : incoming.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : incoming.slice(queryIndex);
  const suffix = pathOnly.replace(/^\/seerr/, "") || "/";
  const basePath = target.pathname === "/" ? "" : target.pathname.replace(/\/$/, "");
  return `${basePath}${suffix.startsWith("/") ? suffix : `/${suffix}`}${query}`;
}

export function rewriteSeerrCookie(cookie) {
  const withoutDomain = cookie.replace(/;\s*Domain=[^;]*/i, "");
  if (!/;\s*Path=/i.test(withoutDomain)) return `${withoutDomain}; Path=/seerr/`;
  return withoutDomain.replace(/;\s*Path=([^;]*)/i, (_match, path) => {
    const normalized = String(path).trim();
    const suffix = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return `; Path=/seerr${suffix === "/" ? "/" : suffix}`;
  });
}

export function proxySeerrRequest(request, response, target) {
  const transport = target.protocol === "https:" ? https : http;
  const headers = { ...request.headers, host: target.host };
  for (const name of HOP_HEADERS) delete headers[name];
  const upstream = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: request.method,
      path: seerrUpstreamPath(target, request.url),
      headers,
    },
    (upstreamResponse) => {
      const outgoing = { ...upstreamResponse.headers };
      const cookies = upstreamResponse.headers["set-cookie"];
      if (cookies) {
        outgoing["set-cookie"] = cookies.map(rewriteSeerrCookie);
      }
      response.writeHead(upstreamResponse.statusCode || 502, outgoing);
      upstreamResponse.pipe(response);
    },
  );
  upstream.setTimeout(20000, () => {
    upstream.destroy(new Error("Seerr proxy timed out"));
  });
  upstream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        message: "Cannot reach Seerr through this app. Check the server address.",
      }),
    );
  });
  request.pipe(upstream);
}

export function seerrProxyMiddleware(fallback) {
  return (request, response, next) => {
    const url = request.url || "";
    if (url !== "/seerr" && !url.startsWith("/seerr/")) {
      next();
      return;
    }
    const header = request.headers["x-seerr-upstream"];
    const target = resolveSeerrTarget(
      Array.isArray(header) ? header[0] : header,
      fallback,
    );
    proxySeerrRequest(request, response, target);
  };
}
