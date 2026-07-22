# Stage 1: install dependencies in a clean layer so the host's node_modules
# directory never contaminates the build.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Stage 2: build the Next.js app
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder
WORKDIR /app

# Set build-time env before the build runs.
# BACKEND_ORIGIN is read by Next.js rewrites() at server start time, so it
# is also passed as a runtime env var in docker-compose. The ARG/ENV here
# provides the correct default for the internal Docker network.
ARG BACKEND_ORIGIN=http://backend:4000
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN} \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy source first (.dockerignore excludes node_modules, .next, .env*, etc.)
# then overlay the clean install from the deps stage so the host's
# node_modules directory (if any) never overwrites it.
COPY . .
COPY --from=deps /app/node_modules ./node_modules

RUN npm run build

# Stage 3: minimal runtime image - no node_modules needed, standalone is
# self-contained.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app

# HOSTNAME=0.0.0.0 is required: Next.js standalone defaults to binding on
# 127.0.0.1, which is unreachable from outside the container.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
