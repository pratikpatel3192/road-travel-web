# syntax=docker/dockerfile:1
#
# Production container for road-travel-web (Angular SPA) on Cloud Run.
# One image serves every environment (ADR-0024): the static bundle is built once, and the runtime
# `config.json` is generated at container start from env vars (the app fetches `/config.json` at
# startup — see src/app/core/config.ts). Served by nginx with SPA fallback, listening on $PORT.

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build            # ng build -> dist/road-travel-web/browser

# ---------- runtime ----------
# SEC-11: run the server as a NON-ROOT user. nginxinc/nginx-unprivileged runs as uid 101 and
# listens on 8080 by default, keeping the same docker-entrypoint.d + envsubst-on-templates behavior
# as the official image. We drop to root only to copy files and make the web root writable (the
# startup script generates config.json there as the non-root user), then switch back to uid 101.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
USER root
# SPA server config; the nginx image envsubst's ${PORT} from this template at startup.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
# Generate /config.json from env before nginx starts (nginx image runs docker-entrypoint.d/*.sh).
COPY docker/40-generate-config.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
# The Angular application-builder output (index.html + assets live under browser/).
COPY --from=build /app/dist/road-travel-web/browser /usr/share/nginx/html
# config.json is written here at startup by the non-root runtime user, so it must own the web root.
RUN chown -R 101:101 /usr/share/nginx/html
USER 101
ENV PORT=8080
EXPOSE 8080
# The unprivileged entrypoint runs docker-entrypoint.d/*.sh + envsubst on templates as uid 101, then
# starts nginx (CMD ["nginx","-g","daemon off;"]). No override needed.
