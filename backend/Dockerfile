# Multi-stage production container for RailSignal Fastify API & BullMQ workers
# Context must be the monorepo root: docker build -f backend/Dockerfile .

# Stage 1: Base image with OpenSSL and libc compatibility for Prisma engine on Alpine
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Stage 2: Full dependencies for building
FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY client/package.json client/
RUN npm ci

# Stage 3: Production dependencies only
FROM base AS prod-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY client/package.json client/
RUN npm ci --omit=dev

# Stage 4: Build shared packages, swap Prisma provider to PostgreSQL, generate Prisma client, and compile TypeScript
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
RUN npm run build --workspace=@railsignal/shared

COPY backend/ backend/
RUN npm run prisma:prep-prod --workspace=@railsignal/backend
RUN npm run prisma:generate --workspace=@railsignal/backend
RUN npm run build --workspace=@railsignal/backend

# Stage 5: Minimal production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy production node_modules from prod-dependencies
COPY --chown=node:node --from=prod-dependencies /app/node_modules ./node_modules

# Copy Prisma schema and generated PostgreSQL Prisma client from builder
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/backend/prisma ./prisma

# Copy compiled shared package and backend dist
COPY --chown=node:node --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=node:node --from=builder /app/packages/shared/dist ./node_modules/@railsignal/shared/dist
COPY --chown=node:node --from=builder /app/packages/shared/package.json ./node_modules/@railsignal/shared/package.json
COPY --chown=node:node --from=builder /app/backend/dist ./dist
COPY --chown=node:node --from=builder /app/backend/package.json ./package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
