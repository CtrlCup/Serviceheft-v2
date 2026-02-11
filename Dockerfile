# ═══════════════════════════════════════════════════
# Digitales Serviceheft – Multi-stage Docker Build
# ═══════════════════════════════════════════════════

# ─── Stage 1: Build Client ────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ─── Stage 2: Build Server ────────────────────────
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ─── Stage 3: Production ─────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built artifacts
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=server-build /app/server/dist ./server/dist

# Copy config
COPY config.json ./config.json

# Create directories
RUN mkdir -p server/data server/uploads

EXPOSE 3001
EXPOSE 41234/udp

CMD ["node", "server/dist/index.js"]
