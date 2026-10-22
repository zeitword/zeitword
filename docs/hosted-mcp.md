# Hosted MCP

Endpoint: `${NUXT_PUBLIC_APP_URL}/mcp` (production: `https://app.zeitword.com/mcp`).

One OAuth connection gives an account access to all its current workspaces. Available tools:

- `get_context`: account identity and memberships
- `list_workspaces`: workspace IDs, names and roles
- `list_sites(workspaceId)`: active sites in an explicitly selected workspace
- `get_site(siteId)`: site details and owning workspace
- `create_site(workspaceId, id, name, domain?, defaultLanguage?)`: create a site and enable its default language (defaults to `en`) in one transaction
- `list_stories(siteId, offset?, limit?)`: paginated story summaries
- `get_story`: stored content, revision and editor URL; use `full: true` before editing
- `search_content`: paginated title, slug and content search across folders
- `list_components`, `get_component`: schemas, fields, options and block whitelists
- `list_languages`, `get_translation_status`: enabled and stored locales
- `validate_story`: validate stored or proposed content without saving
- `patch_story_content`: atomic, schema-validated edits to one locale, with dry-run support
- `create_story`, `update_story`, `delete_story`: create, rename or soft-delete stories
- `list_assets`, `get_asset`, `update_asset`: discover assets and rename filename metadata

## Editing content

Writes require both `mcp:read` and `mcp:write`. A read-only token receives the
standard OAuth `insufficient_scope` challenge on a write, so the client can
request additional consent. Removing write consent immediately blocks edits.

Read component schemas and then `get_story(full: true)` before editing. Pass its
`revision` as `expectedRevision` to patch, rename or delete the story. Revisions
cover content, metadata and the database's exact update timestamp. Stale writes
return a structured `CONFLICT`; reread and reconcile rather than blindly retry.

Patch paths use field keys and stable `{blockId}` selectors. Operations are
`set`, `unset`, `insert_block`, `remove_block` and `move_block`. Every batch is
applied to a clone, validated, and committed in a transaction. Failed validation
writes nothing, `dryRun` returns the proposed content without saving, and other
locales are preserved. Story and asset references must belong to the same site.
Membership and site rows are held through each transaction so archiving cannot
race an already-authorized edit.

Creates require a client-generated UUID. After a lost response, inspect that ID;
do not retry with a new ID. Duplicate IDs or active slugs return `CONFLICT`.
For site creation, use `get_site(siteId)` to inspect the supplied ID. Any current
workspace member can create a site with write authorization. The default language
must exist in the supported language catalog; invalid languages create nothing.
Deletion soft-deletes one story, never a folder and its descendants.

OAuth grants apply to the account, including workspaces joined later. Memberships
are checked against the database for every tool request. There is no selected
workspace in the token or MCP transport; dashboard switching is independent.
Archived workspaces, archived memberships and soft-deleted sites are excluded.

## Transport and authorization

The official MCP TypeScript SDK v2 serves the `2026-07-28` protocol. The handler
accepts independent POSTs and rejects the legacy protocol. GET and DELETE return 405. A fresh MCP server is created for every request; replicas need no sticky
sessions or shared MCP session store.

Better Auth composes `jwt()`, `mcp()` and `cimd()` with the pinned
`mcp-2026-07-28` metadata profile and the bundled Node metadata transport.
Clients use discovery, authorization code + S256 PKCE and optional refresh tokens.
Dynamic registration is disabled. Client identity uses CIMD or an explicitly
registered client. Clients must support the modern protocol; the SDK client must
set `versionNegotiation: { mode: { pin: "2026-07-28" } }`.

The authorization page verifies the signed OAuth query before rendering it.
Requested scopes and OIDC claims are displayed before consent. `mcp:read` is
required for MCP access. JWT signature, issuer, audience and expiry are checked
by Better Auth. Current account, originating session, auth version, client state,
consent and workspace membership are checked from the database. Logout, account
deletion, disabled clients and removed read consent immediately stop access.
Membership removal only stops access to that workspace.

OAuth clients, signing keys, grants, refresh tokens and replay protection remain
durable database state. “Stateless” refers to the MCP transport.

## Local verification

Build first, then use a new empty local PostgreSQL database:

```sh
mise exec -- npm run build
TEST_DSN=postgresql://.../empty_mcp_test mise exec -- npm run test:e2e:mcp
```

The test applies migrations, runs real browser sign-in/consent, exchanges and
refreshes tokens, connects the official MCP client, and checks concurrent
workspace access, tenant isolation, soft deletion and authorization revocation.
The migration is additive and must run before deploying the new server.

The E2E suite also checks site creation and default-language initialization,
write-scope step-up, nested block edits, cross-workspace creation,
locale preservation, dry runs, validation rollback, concurrent edits,
foreign references, asset renaming and story soft deletion.
