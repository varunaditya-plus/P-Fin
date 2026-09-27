import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const image = process.env.PFIN_TEST_IMAGE || "p-fin:local";
const fixture = fileURLToPath(
  new URL("./fixtures/upstream.mjs", import.meta.url),
);
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const request = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(10000) });

test(
  "NAS container configuration and proxies",
  { timeout: 120000 },
  async (t) => {
    const network = `p-fin-test-${process.pid}`;
    const containers = [];
    t.after(() => {
      for (const name of containers.reverse()) docker("rm", "-f", name);
      docker("network", "rm", network);
    });
    docker("network", "create", network);

    async function start(name, env = {}) {
      const container = `${network}-${name}`;
      docker(
        "run",
        "-d",
        "--name",
        container,
        "--network",
        network,
        "--read-only",
        "--tmpfs",
        "/tmp",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--health-interval",
        "1s",
        "-p",
        "127.0.0.1::8080",
        ...Object.entries(env).flatMap(([key, value]) => [
          "-e",
          `${key}=${value}`,
        ]),
        image,
      );
      containers.push(container);
      const address = docker("port", container, "8080/tcp").split("\n")[0];
      const base = `http://${address}`;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
          if ((await request(`${base}/health`)).ok) return { base, container };
        } catch {
          /* Port forwarding can take a moment on a local VM. */
        }
        const running = docker(
          "inspect",
          "--format",
          "{{.State.Running}}",
          container,
        );
        if (running !== "true") throw new Error(docker("logs", container));
        await delay(200);
      }
      throw new Error(`Container did not start: ${docker("logs", container)}`);
    }

    const empty = await start("empty");
    await t.test(
      "starts without any server configuration, as non-root on a read-only filesystem",
      async () => {
        assert.notEqual(docker("exec", empty.container, "id", "-u"), "0");
        assert.deepEqual(
          await (await request(`${empty.base}/server-config.json`)).json(),
          { jellyfinUrl: "", seerrUrl: "" },
        );
        assert.equal(
          (await request(`${empty.base}/jellyfin/System/Info/Public`)).status,
          503,
        );
        assert.equal(
          (await request(`${empty.base}/seerr/api/v1/status`)).status,
          503,
        );
        for (const route of [
          "/",
          "/login",
          "/discover",
          "/settings",
          "/play/example",
        ]) {
          const response = await request(empty.base + route);
          assert.equal(response.status, 200);
          assert.match(response.headers.get("cache-control"), /no-cache/);
          assert.match(await response.text(), /<title>P-Fin<\/title>/);
        }
        assert.equal(
          (await request(`${empty.base}/assets/missing.js`)).status,
          404,
        );
      },
    );

    // Start the app before its upstream exists, as happens during a NAS reboot.
    const configured = await start("configured", {
      JELLYFIN_URL: "http://fixture:8181/jellyfin-root///",
      SEERR_URL: "http://fixture:8181/seerr-root/",
    });
    const upstream = `${network}-upstream`;
    docker(
      "run",
      "-d",
      "--name",
      upstream,
      "--network",
      network,
      "--network-alias",
      "fixture",
      "--mount",
      `type=bind,source=${path.resolve(fixture)},target=/fixture.mjs,readonly`,
      "node:22-alpine",
      "node",
      "/fixture.mjs",
    );
    containers.push(upstream);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        docker(
          "exec",
          upstream,
          "wget",
          "-q",
          "-O",
          "/dev/null",
          "http://127.0.0.1:8181/",
        );
        break;
      } catch {
        if (attempt === 49) throw new Error("Test upstream did not start");
        await delay(100);
      }
    }

    await t.test(
      "resolves Docker service names after startup and preserves base paths, encoded URLs and auth",
      async () => {
        const config = await request(`${configured.base}/server-config.json`);
        assert.equal(config.headers.get("cache-control"), "no-store");
        assert.deepEqual(await config.json(), {
          jellyfinUrl: "http://fixture:8181/jellyfin-root",
          seerrUrl: "http://fixture:8181/seerr-root",
        });
        const response = await request(
          `${configured.base}/jellyfin/Items/a%2Fb?search=one%20two`,
          {
            headers: {
              Authorization: 'MediaBrowser Token="fixture-token"',
              "X-Forwarded-Proto": "https",
            },
          },
        );
        const body = await response.json();
        assert.equal(body.url, "/jellyfin-root/Items/a%2Fb?search=one%20two");
        assert.equal(
          body.headers.authorization,
          'MediaBrowser Token="fixture-token"',
        );
        assert.equal(body.headers["x-forwarded-proto"], "https");
      },
    );

    await t.test(
      "forwards ranged playback, WebSocket upgrades and subtitle/image upload bodies",
      async () => {
        const range = await request(`${configured.base}/jellyfin/video`, {
          headers: { Range: "bytes=2-5" },
        });
        assert.equal(range.status, 206);
        assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
        assert.equal(await range.text(), "2345");
        const upload = await request(
          `${configured.base}/jellyfin/Items/image`,
          { method: "POST", body: "a".repeat(2 * 1024 * 1024) },
        );
        assert.equal((await upload.json()).bytes, 2 * 1024 * 1024);
        const url = new URL(configured.base);
        const handshake = await new Promise((resolve, reject) => {
          const socket = net.connect(Number(url.port), url.hostname, () => {
            socket.write(
              "GET /jellyfin/socket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
            );
          });
          socket.setTimeout(5000, () =>
            socket.destroy(new Error("WebSocket timeout")),
          );
          socket.once("error", reject);
          socket.once("data", (data) => {
            resolve(data.toString());
            socket.destroy();
          });
        });
        assert.match(handshake, /^HTTP\/1.1 101/);
      },
    );

    await t.test(
      "supports Seerr cookie and API-key login, configured or chosen in the interface",
      async () => {
        const login = await request(
          `${configured.base}/seerr/api/v1/auth/local`,
          { method: "POST", body: "{}" },
        );
        const cookie = login.headers.get("set-cookie");
        assert.match(cookie, /Path=\/seerr\//);
        assert.match(cookie, /Domain=127\.0\.0\.1/);
        const chosen = await request(
          `${empty.base}/seerr/api/v1/search?query=a%26b`,
          {
            headers: {
              "X-Seerr-Upstream": "http://fixture:8181/another-base",
              "X-Api-Key": "fixture-api-key",
              Cookie: "connect.sid=test-session",
            },
          },
        );
        const body = await chosen.json();
        assert.equal(body.url, "/another-base/api/v1/search?query=a%26b");
        assert.equal(body.headers["x-api-key"], "fixture-api-key");
        assert.equal(body.headers.cookie, "connect.sid=test-session");
        assert.equal(body.headers["x-seerr-upstream"], undefined);
      },
    );

    await t.test(
      "rejects malformed environment values without including them in logs",
      () => {
        for (const value of [
          'http://fixture/"; invalid',
          "http://name:secret@fixture",
          "http://fixture/?secret=123",
          "http://fixture\ninvalid",
        ]) {
          assert.throws(
            () => docker("run", "--rm", "-e", `JELLYFIN_URL=${value}`, image),
            (error) => {
              assert.match(String(error.stderr), /JELLYFIN_URL must be/);
              assert.doesNotMatch(String(error.stderr), /secret|invalid/);
              return true;
            },
          );
        }
        const config = docker(
          "run",
          "--rm",
          "--read-only",
          "--tmpfs",
          "/tmp",
          "-e",
          "JELLYFIN_URL=https://[::1]:8096/a$b",
          image,
          "nginx",
          "-c",
          "/tmp/p-fin/nginx.conf",
          "-t",
        );
        assert.equal(config, "");
      },
    );

    await t.test(
      "reports a healthy container without depending on upstream login or availability",
      async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (
            docker(
              "inspect",
              "--format",
              "{{.State.Health.Status}}",
              empty.container,
            ) === "healthy"
          )
            return;
          await delay(250);
        }
        assert.fail("Docker healthcheck did not become healthy");
      },
    );
  },
);
