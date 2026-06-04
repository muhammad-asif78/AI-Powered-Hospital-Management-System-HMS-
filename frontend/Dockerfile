# ============================================================
# Stage 1 — Build the Vite React SPA only
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time env vars (Vite bakes these into the JS bundle at compile time)
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

# Install all dependencies (needed for Vite + Tailwind build)
COPY package*.json ./
RUN npm install --prefer-offline

# Copy source and compile only the SPA (skip esbuild server bundling)
COPY . .
RUN npx vite build

# ============================================================
# Stage 2 — Production runtime (Express server + compiled assets)
# ============================================================
FROM node:20-alpine AS runner

# Non-root security hardening
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install all server deps (express, dotenv, http-proxy-middleware, tsx, etc.)
COPY package*.json ./
RUN npm install --prefer-offline

# Copy the compiled SPA from builder stage
COPY --from=builder /app/dist ./dist

# Copy the Express server and TS config
COPY server.ts ./
COPY tsconfig.json ./

# Switch to non-root user
USER appuser

EXPOSE 3000

ENV NODE_ENV=production

# Run the Express server directly with tsx (no esbuild bundling needed)
CMD ["node_modules/.bin/tsx", "server.ts"]
