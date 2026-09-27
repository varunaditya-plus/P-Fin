import http from "node:http";

// Only used by the container smoke tests; never copied into the runtime image.
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (request.url === "/jellyfin-root/video" && request.headers.range) {
    response.writeHead(206, {
      "Content-Type": "video/mp4",
      "Content-Range": "bytes 2-5/10",
      "Accept-Ranges": "bytes",
      "Content-Length": "4",
    });
    response.end("2345");
    return;
  }
  if (request.url?.endsWith("/auth/local")) {
    response.setHeader(
      "Set-Cookie",
      "connect.sid=test-session; Domain=fixture; Path=/seerr-root; HttpOnly; SameSite=Lax",
    );
  }
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      url: request.url,
      method: request.method,
      headers: request.headers,
      bytes: Buffer.concat(chunks).length,
    }),
  );
});
server.on("upgrade", (_request, socket) => {
  socket.end(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
  );
});
server.listen(8181, "0.0.0.0");
