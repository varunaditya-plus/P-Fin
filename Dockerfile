# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=p-fin-pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . ./
RUN pnpm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
ENV JELLYFIN_URL="" SEERR_URL=""
LABEL org.opencontainers.image.title="P-Fin" \
      org.opencontainers.image.description="Jellyfin web client with optional Seerr discovery and requests" \
      org.opencontainers.image.licenses="MIT"
COPY deploy/nginx.conf.template /etc/nginx/templates/p-fin.conf.template
COPY deploy/docker-entrypoint.sh /opt/p-fin/docker-entrypoint.sh
COPY LICENSE.md /usr/share/licenses/p-fin/LICENSE.md
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/bin/sh", "/opt/p-fin/docker-entrypoint.sh"]
CMD ["nginx", "-c", "/tmp/p-fin/nginx.conf", "-g", "daemon off;"]
