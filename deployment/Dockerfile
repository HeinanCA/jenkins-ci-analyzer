FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile

# Build shared
FROM base AS shared-build
COPY packages/shared packages/shared

# Build API
FROM shared-build AS api-build
COPY packages/api packages/api

# API runtime
FROM api-build AS api
CMD ["pnpm", "--filter", "@tig/api", "dev"]

# Worker runtime
FROM api-build AS worker
CMD ["pnpm", "--filter", "@tig/api", "worker"]

# Build frontend
FROM shared-build AS frontend-build
COPY packages/frontend packages/frontend
RUN cd packages/frontend && npx vite build

# Frontend runtime
FROM nginx:alpine AS frontend
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/packages/frontend/dist /usr/share/nginx/html
