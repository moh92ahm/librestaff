FROM node:22.17.0-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
ARG PNPM_VERSION=10
RUN corepack disable && npm install -g pnpm@${PNPM_VERSION}

# Dependencies stage
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --production=false

# Build stage
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm run build

# Runtime stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV HOME=/app
ENV TMPDIR=/tmp
ENV USER=nextjs

RUN apk add --no-cache curl \
    && rm -f /usr/bin/wget /bin/wget

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Create all necessary directories with proper permissions
RUN mkdir -p /app/public/media \
    && mkdir -p /app/storage/media \
    && mkdir -p /app/.cache \
    && mkdir -p /app/.next \
    && mkdir -p /tmp \
    && chmod 1777 /tmp \
    && chown -R nextjs:nodejs /app

# Keep full node_modules because the migrate service runs drizzle-kit from this image.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/src/seed ./src/seed
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Add health check using curl instead of wget for security
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["pnpm", "start"]
