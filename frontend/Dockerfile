FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ARG VITE_SHOW_BASTIDORES=true
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
ENV VITE_SHOW_BASTIDORES=$VITE_SHOW_BASTIDORES
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
USER root
RUN apk upgrade --no-cache
USER 101
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
