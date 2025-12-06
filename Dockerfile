#syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base

# Declare build arguments
ARG GITHUB_APP_CLIENT_ID
ARG GITHUB_APP_CLIENT_SECRET
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL

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

# Expose the build arguments as environment variables for the build process
ENV GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
ENV GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV DATABASE_URL=${DATABASE_URL}

# Build documentation
RUN cd tea-docs && corepack enable pnpm && pnpm i && pnpm build

RUN if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm build; else yarn build; fi

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN \
  addgroup -g 1001 -S nodejs; \
  adduser -S nextjs -u 1001

# Install Prisma CLI for migrations
RUN npm install -g prisma@7.0.0

COPY --from=builder --link /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --link --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --link --chown=1001:1001 /app/.next/static ./.next/static

# Copy Prisma schema and migrations for runtime migrations
COPY --from=builder --link --chown=1001:1001 /app/prisma/schema.new.prisma ./prisma/schema.prisma
COPY --from=builder --link --chown=1001:1001 /app/prisma/migrations ./prisma/migrations

# Copy and set up entrypoint script
COPY --link --chown=1001:1001 scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
