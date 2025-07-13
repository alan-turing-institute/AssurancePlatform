#syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps

# Install dependencies needed for compatibility
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY --link package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi


# 2. Rebuild the source code only when needed
FROM base AS builder

# Install dependencies needed for compatibility
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY --from=deps --link /app/node_modules ./node_modules
COPY --link . .
# This will do the trick, use the corresponding env file for each environment.
COPY --link .env.local .env.production
# COPY --link .env.production .env.production

# Build documentation
RUN cd tea-docs && corepack enable pnpm && pnpm i && pnpm build

RUN if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm build; else yarn build; fi

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN \
  addgroup -g 1001 -S nodejs; \
  adduser -S nextjs -u 1001

COPY --from=builder --link /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --link --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --link --chown=1001:1001 /app/.next/static ./.next/static


USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
