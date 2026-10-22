ARG NODE_VERSION=26.12.1-alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /usr/src/app

# Prepare Nuxt only after its configuration and source files are available.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run postinstall && npm run build

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
