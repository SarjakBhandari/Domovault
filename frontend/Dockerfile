# Stage 1: install dependencies in a clean layer.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Stage 2: build the Next.js app.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder
WORKDIR /app
ARG BACKEND_ORIGIN=http://backend:4000
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN} \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# Stage 3: minimal runtime image.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app

# HOSTNAME=0.0.0.0: Next.js standalone defaults to 127.0.0.1 which is
# unreachable from outside the container.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# HTTPS wrapper. TLS certificates are mounted at /app/certs at runtime via
# docker-compose (see ../docker-compose.yml). Replace cert.pem / key.pem with
# a real CA-signed certificate for production.
COPY --chown=node:node server-https.js ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';fetch('https://localhost:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server-https.js"]
