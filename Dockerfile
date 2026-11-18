# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Bump this from Ansible to guarantee a fresh build of the app layers while
# still reusing dependency and base-image layers.
ARG CACHEBUST=0
RUN echo "${CACHEBUST}" > /app/.cachebust

COPY . .

# Optional build-time API origin for static hosting without the runtime config.
# API_BASE_URL at container start takes precedence over this value.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf.template /etc/nginx/jaunt/nginx.conf.template
COPY deploy/40-jaunt-config.sh /docker-entrypoint.d/40-jaunt-config.sh
RUN chmod +x /docker-entrypoint.d/40-jaunt-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
