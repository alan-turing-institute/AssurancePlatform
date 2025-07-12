# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base

# Declare build arguments
ARG GITHUB_APP_CLIENT_ID
ARG GITHUB_APP_CLIENT_SECRET
ARG NEXTAUTH_SECRET
ARG NEXT_PUBLIC_API_URL
ARG API_URL
ARG NEXTAUTH_URL

# 1. Install dependencies only when needed
FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY --link package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps --link /app/node_modules ./node_modules
COPY --link . .

# Expose the build arguments as environment variables for the build process
ENV GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
ENV GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV API_URL=${API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

# Build documentation
RUN cd tea-docs && npm ci && npm run build

RUN yarn build

RUN echo "Build-time ENV variables:" && \
  echo GITHUB_APP_CLIENT_ID=$GITHUB_APP_CLIENT_ID && \
  echo GITHUB_APP_CLIENT_SECRET=$GITHUB_APP_CLIENT_SECRET && \
  echo NEXTAUTH_SECRET=$NEXTAUTH_SECRET && \
  echo NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL && \
  echo NEXTAUTH_URL=$NEXTAUTH_URL

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN \
  addgroup -g 1001 -S nodejs; \
  adduser -S nextjs -u 1001

COPY --from=builder --link /app/public ./public
COPY --from=builder --link --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --link --chown=1001:1001 /app/.next/static ./.next/static

# Ensure the environment variables are available at runtime
ENV GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
ENV GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV API_URL=${API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]

RUN echo "Runtime ENV variables:" && \
  echo GITHUB_APP_CLIENT_ID=$GITHUB_APP_CLIENT_ID && \
  echo GITHUB_APP_CLIENT_SECRET=$GITHUB_APP_CLIENT_SECRET && \
  echo NEXTAUTH_SECRET=$NEXTAUTH_SECRET && \
  echo NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL && \
  echo NEXTAUTH_URL=$NEXTAUTH_URL
