# syntax=docker/dockerfile:1
# ============================================================================
# Base stage — shared Node.js 24 + pnpm setup.
# All per-component stages inherit from this.
# ============================================================================
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ============================================================================
# Backend dev stage
# Installs all workspace deps using the BuildKit pnpm store cache so that
# repeated builds reuse already-downloaded packages.
# Source code is bind-mounted at runtime (see docker-compose.yml).
# node_modules are protected in named volumes so the bind mount cannot
# overwrite installed packages.
# ============================================================================
FROM base AS backend-dev
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/nest-cli.json apps/backend/mikro-orm.config.ts ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/e2e/package.json ./apps/e2e/
RUN mkdir -p packages/shared/src apps/backend/src apps/frontend/src apps/e2e/tests
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install
EXPOSE 3000

# ============================================================================
# Frontend dev stage
# ============================================================================
FROM base AS frontend-dev
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/tsconfig.spec.json apps/frontend/angular.json apps/frontend/proxy.conf.json ./apps/frontend/
COPY apps/e2e/package.json ./apps/e2e/
RUN mkdir -p packages/shared/src apps/backend/src apps/frontend/src apps/e2e/tests
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install
EXPOSE 4200

# ============================================================================
# E2E stage
# Installs Playwright and downloads the Chromium browser binary.
# Tests are mounted at runtime; node_modules live in a named volume.
# ============================================================================
FROM base AS e2e
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/e2e/package.json ./apps/e2e/
RUN mkdir -p packages/shared/src apps/backend/src apps/frontend/src apps/e2e/tests
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install
RUN pnpm --filter @whos-next/e2e exec playwright install --with-deps chromium
