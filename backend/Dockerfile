# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Install native deps yang dibutuhkan tesseract.js di Alpine
RUN apk add --no-cache \
    libc6-compat \
    cairo-dev \
    pango-dev

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Copy tesseract traineddata files
COPY eng.traineddata ./
COPY ind.traineddata ./

EXPOSE 8080
CMD ["npm", "run", "start"]
