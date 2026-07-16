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
FROM nginx:1.27-alpine AS runtime
# SPA server config; the nginx image envsubst's ${PORT} from this template at startup.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
# Generate /config.json from env before nginx starts (nginx image runs docker-entrypoint.d/*.sh).
COPY docker/40-generate-config.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
# The Angular application-builder output (index.html + assets live under browser/).
COPY --from=build /app/dist/road-travel-web/browser /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
# nginx:alpine's default entrypoint runs docker-entrypoint.d/*.sh + envsubst on templates, then
# starts nginx (CMD ["nginx","-g","daemon off;"]). No override needed.
