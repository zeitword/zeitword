# Dependency upgrade regression tests

Use Node 26.12.1 via mise. Install with `mise install` and `mise exec -- npm ci`.

```sh
mise exec -- npm test
mise exec -- npm run lint
mise exec -- npm run build
```

Vitest runs the component and server suites. The component suite mounts the actual Vue, Tiptap, Reka UI, and Vue Router components in Happy DOM. The AI SDK test uses an in-memory OpenAI Responses fixture and does not send network requests.

## Browser end-to-end test

This test creates an organisation, user, site, component, and story. **Use a disposable local database, never production.** It checks registration, session authentication, a site creation modal, rich-text editing and persistence across reloads, logout/login, and router navigation. The test refuses non-loopback app URLs.

Example setup (requires Docker):

```sh
docker run --rm -d --name zeitword-regression-db \
  -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=zeitword_test \
  -p 127.0.0.1:55432:5432 postgres:18.6-alpine
# Wait until this succeeds:
docker exec zeitword-regression-db pg_isready -U postgres

export NUXT_DSN='postgresql://postgres:local-test-only@127.0.0.1:55432/zeitword_test'
export NUXT_AUTH_SECRET='local-regression-only-at-least-32-characters'
export NUXT_PUBLIC_APP_URL='http://127.0.0.1:3100'
mise exec -- npm run db:migrate
mise exec -- npm run build
HOST=127.0.0.1 PORT=3100 mise exec -- node .output/server/index.mjs
```

In another terminal:

```sh
mise exec -- npx playwright install --with-deps chromium
TEST_BASE_URL=http://127.0.0.1:3100 mise exec -- npm run test:e2e
# Stop the app, then discard its test data:
docker stop zeitword-regression-db
```

No external AI, email, or S3 credentials are needed for this test. Live email delivery, paid AI calls, and production data migrations are not covered.

## Authentication migration end-to-end test

The auth test requires a **fresh, empty, disposable PostgreSQL database**. It applies the old migrations, inserts legacy credentials, PATs, site API keys and an invitation, then applies the Better Auth migration. It starts and stops the built app itself on port 3198 (`TEST_PORT` overrides it).

```sh
docker run --rm -d --name zeitword-auth-test-db \
  -e POSTGRES_PASSWORD=auth-test-only -e POSTGRES_DB=zeitword_auth_test \
  -p 127.0.0.1:55440:5432 postgres:18.6-alpine
mise exec -- npm run build
TEST_DSN=postgresql://postgres:auth-test-only@127.0.0.1:55440/zeitword_auth_test \
  mise exec -- npm run test:e2e:auth
docker stop zeitword-auth-test-db
```

Playwright exercises the HTTP API and Chromium login/logout. Checks include case-collision migration rollback, exact hash/ID preservation, transactional registration (including an injected session-insert failure), concurrent invitation acceptance, server-owned organisation fields, archived-user transfer and revocation, password-reset generation/consumption/replay, and expired sessions. Recovery email delivery is replaced with an in-process capture using the same auth configuration. Actual Resend delivery requires deployment verification.

## Version and security constraints

- Drizzle ORM and Kit are pinned to the official `1.0.0-rc.5` release, preserving the existing release-candidate API rather than downgrading to the older stable API. Exact pins avoid selecting experimental hash-suffixed builds. Its snapshot format is v9; the tool-generated snapshot upgrades must ship with the tooling update. Existing migration SQL is unchanged.
- `@aws-sdk/client-s3` is pinned to `3.1154.0`. At upgrade time, `3.1155.0` was advertised but could not resolve required unpublished packages, including `@aws-sdk/types@^3.975.0`. Retry that patch once all of its dependencies are published.
- `postcss-selector-parser` is overridden to patched v7 because the latest Tailwind typography plugin pins vulnerable v6. Remove the override when the upstream dependency catches up.
- `archiver-utils` uses a scoped `glob` v13 override to replace its deprecated v10 dependency. Remove the override when upstream updates its dependency. Its synchronous glob API is verified separately from the Nuxt build.
- Full lockfile auditing still reports high-severity advisories in `braces@3.0.3` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) and `node-forge@1.4.0` ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)). Both are latest published versions with no patched release at upgrade time and come through Nitro's build/development tooling. They are not present in the verified standalone production output. Keep auditing and update when upstream fixes are released; the audit intentionally remains nonzero.
- The repository's root `tsc --noEmit` check has pre-existing errors (60 diagnostics in both the baseline and upgraded checkout). It is not a passing project gate. `vue-tsc@3.3.13` also cannot load TypeScript 7's removed `typescript/lib/tsc` entry point. Production compilation and regression tests are separate checks, not substitutes for a clean future type-checking baseline.

Audit all three npm lockfiles separately:

```sh
mise exec -- npm audit
(cd packages/mcp && mise exec -- npm audit)
(cd packages/schema && mise exec -- npm audit)
```
