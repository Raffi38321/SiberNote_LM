# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_BASE_URL di-inject saat build supaya terbake ke static bundle
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


# ── Stage 2: serve dengan nginx ──────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Hapus default config nginx
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Metadata untuk image
LABEL org.opencontainers.image.title="SiberNote LM Frontend"
LABEL org.opencontainers.image.description="React + Vite + Nginx frontend for SiberNote LM application"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="SiberNote LM Team"

CMD ["nginx", "-g", "daemon off;"]
