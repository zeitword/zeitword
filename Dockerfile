ARG NODE_VERSION=24.22.1-alpine
ARG BUN_VERSION=1.4.3-alpine

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION} AS build
WORKDIR /usr/src/app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Prepare Nuxt only after its configuration and source files are available.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run postinstall && bun run build

# Nuxt's output includes all required runtime dependencies.
FROM node:${NODE_VERSION} AS release
WORKDIR /usr/src/app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /usr/src/app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
