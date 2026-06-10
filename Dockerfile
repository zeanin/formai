FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-workspace.yaml ./
# Copy lockfile if present (may not exist in all environments)
COPY pnpm-lock.yaml* ./

# Copy package manifests for all workspaces
COPY packages/core/acl/package.json ./packages/core/acl/
COPY packages/core/ai/package.json ./packages/core/ai/
COPY packages/core/auth/package.json ./packages/core/auth/
COPY packages/core/client/package.json ./packages/core/client/
COPY packages/core/database/package.json ./packages/core/database/
COPY packages/core/plugin/package.json ./packages/core/plugin/
COPY packages/core/resourcer/package.json ./packages/core/resourcer/
COPY packages/core/schema-engine/package.json ./packages/core/schema-engine/
COPY packages/core/sdk/package.json ./packages/core/sdk/
COPY packages/core/server/package.json ./packages/core/server/
COPY packages/core/shared/package.json ./packages/core/shared/

COPY packages/plugins/acl/package.json ./packages/plugins/acl/
COPY packages/plugins/api-doc/package.json ./packages/plugins/api-doc/
COPY packages/plugins/audit-log/package.json ./packages/plugins/audit-log/
COPY packages/plugins/backup-restore/package.json ./packages/plugins/backup-restore/
COPY packages/plugins/collection-manager/package.json ./packages/plugins/collection-manager/
COPY packages/plugins/data-visualization/package.json ./packages/plugins/data-visualization/
COPY packages/plugins/file-manager/package.json ./packages/plugins/file-manager/
COPY packages/plugins/import-export/package.json ./packages/plugins/import-export/
COPY packages/plugins/localization/package.json ./packages/plugins/localization/
COPY packages/plugins/notification/package.json ./packages/plugins/notification/
COPY packages/plugins/system-settings/package.json ./packages/plugins/system-settings/
COPY packages/plugins/theme-editor/package.json ./packages/plugins/theme-editor/
COPY packages/plugins/ui-schema-storage/package.json ./packages/plugins/ui-schema-storage/
COPY packages/plugins/users/package.json ./packages/plugins/users/
COPY packages/plugins/workflow/package.json ./packages/plugins/workflow/

COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile || pnpm install

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder

# Copy all source files
COPY tsconfig.base.json tsconfig.json* ./
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build all packages and the server app
RUN pnpm build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 formai

# Copy built output and production dependencies
COPY --from=builder --chown=formai:nodejs /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=formai:nodejs /app/apps/server/package.json ./apps/server/

# Copy packages dist output
COPY --from=builder --chown=formai:nodejs /app/packages ./packages

# Copy workspace config for pnpm resolution
COPY --from=builder --chown=formai:nodejs /app/package.json ./
COPY --from=builder --chown=formai:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=formai:nodejs /app/node_modules ./node_modules

USER formai

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "apps/server/dist/index.js"]
