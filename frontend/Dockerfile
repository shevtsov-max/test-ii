# syntax=docker/dockerfile:1
#
# Фронтенд «Родословной»: сборка Vite → статические файлы, которые раздаёт Caddy.
# Caddy же проксирует API на бэкенд и сам получает HTTPS-сертификат (Let's Encrypt).
# Конфигурация Caddy — docker/caddy/Caddyfile (подключается из docker/compose.prod.yml).
#
# Базовые образы можно заменить (зеркало реестра): --build-arg NODE_IMAGE=… --build-arg CADDY_IMAGE=…
ARG NODE_IMAGE=node:22-alpine
ARG CADDY_IMAGE=caddy:2-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_MODE=graphql
ARG VITE_GRAPHQL_URL=/graphql
ARG VITE_ROUTER_MODE=hash
ARG VITE_OAUTH_PROVIDERS=
ARG VITE_SUPPORT_EMAIL=
ARG VITE_OPERATOR_NAME=
ARG VITE_OPERATOR_INN=
ARG VITE_OPERATOR_OGRN=
ARG VITE_OPERATOR_ADDRESS=
ARG VITE_SITE_URL=
ENV VITE_API_MODE=$VITE_API_MODE VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL VITE_ROUTER_MODE=$VITE_ROUTER_MODE \
    VITE_OAUTH_PROVIDERS=$VITE_OAUTH_PROVIDERS VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL \
    VITE_OPERATOR_NAME=$VITE_OPERATOR_NAME VITE_OPERATOR_INN=$VITE_OPERATOR_INN VITE_OPERATOR_OGRN=$VITE_OPERATOR_OGRN \
    VITE_OPERATOR_ADDRESS=$VITE_OPERATOR_ADDRESS VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

FROM ${CADDY_IMAGE} AS web
COPY --from=build /app/dist /srv
