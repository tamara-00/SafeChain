
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY frontend ./frontend

ARG VITE_THIRDWEB_CLIENT_ID
ENV VITE_THIRDWEB_CLIENT_ID=$VITE_THIRDWEB_CLIENT_ID

RUN npm run build

FROM nginx:1.27-alpine AS production

ENV BACKEND_HOST=backend \
    BACKEND_PORT=8787 \
    NGINX_ENVSUBST_FILTER=^BACKEND_

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/cache/nginx /run
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
