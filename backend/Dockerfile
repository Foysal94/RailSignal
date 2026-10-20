# Multi-stage production Dockerfile for RailSignal Fastify API & BullMQ workers
# Rationale: Build context must be the monorepo root (docker build -f backend/Dockerfile .)
# to resolve workspace dependencies (@railsignal/shared) and root lockfiles.

# Base stage: Node.js 22 LTS Alpine
FROM node:22-alpine AS base
WORKDIR /app
# Rationale: Alpine uses musl libc; Prisma requires OpenSSL and libc compatibility for its query engine.
RUN apk add --no-cache libc6-compat openssl

# Build stage: Install dependencies, swap database provider, generate client, compile TypeScript
FROM base AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY backend/ backend/
COPY client/package.json client/

RUN npm ci
RUN npm run build --workspace=@railsignal/shared
RUN npm run prisma:prep-prod --workspace=@railsignal/backend
RUN npm run prisma:generate --workspace=@railsignal/backend
RUN npm run build --workspace=@railsignal/backend

# Prune devDependencies to isolate runtime production node_modules for the runner stage
RUN npm prune --omit=dev

# Runner stage: Minimal production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Rationale: Copies production node_modules, generated PostgreSQL Prisma binary engine,
# and compiled dist artifacts into an unprivileged container. Dual-copying the shared package
# satisfies both relative monorepo symlinks and direct package-name resolution.
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=node:node --from=build /app/packages/shared/dist ./node_modules/@railsignal/shared/dist
COPY --chown=node:node --from=build /app/packages/shared/package.json ./node_modules/@railsignal/shared/package.json
COPY --chown=node:node --from=build /app/backend/dist ./dist
COPY --chown=node:node --from=build /app/backend/package.json ./package.json
COPY --chown=node:node --from=build /app/backend/prisma ./prisma

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
