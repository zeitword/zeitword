# @zeitword/mcp

MCP (Model Context Protocol) server for Zeitword CMS. Allows AI assistants to manage sites, content, and schemas.

## Setup

```bash
cd packages/mcp
bun install   # also runs `tsc` via the prepare script
```

If you need to rebuild manually:

```bash
bun run build
```

The build output (`build/`) is gitignored and regenerated automatically on install via the `prepare` script.

## Authentication

The MCP server supports three authentication methods (checked in order):

1. **Environment variable**: Set `ZEITWORD_TOKEN=zwpat_...` for CI or non-interactive use
2. **Stored token**: Previously authorized via browser flow (saved in `~/.config/zeitword/mcp-token.json`)
3. **Browser auth flow**: Opens `https://app.zeitword.com/auth/mcp` in your browser, you approve, token is saved locally

## Configuration

### Claude Desktop / OpenCode

Add to your MCP config:

```json
{
  "mcpServers": {
    "zeitword": {
      "command": "node",
      "args": ["/path/to/zeitword/packages/mcp/build/index.js"]
    }
  }
}
```

Make sure you've run `bun install` in `packages/mcp` first so the build output exists.

### Environment variables

- `ZEITWORD_API_URL` — Override the API URL (default: `https://app.zeitword.com`)
- `ZEITWORD_TOKEN` — Pre-set a personal access token (skips browser auth)

## Available Tools

### Sites
- `list_sites` — List all sites in the organization
- `get_site` — Get site details
- `create_site` — Create a new site
- `update_site` — Update site name, domain, or default language
- `delete_site` — Delete a site

### Components (Schemas)
- `list_components` — List all component schemas for a site
- `get_component` — Get component with fields
- `create_component` — Create a new component
- `update_component` — Update a component
- `delete_component` — Delete a component
- `upsert_component_schema` — Idempotent create/update of a component and all its fields in one call

### Fields
- `create_field` — Add a field to a component
- `update_field` — Update a field (supports renaming via `newFieldKey`)
- `delete_field` — Delete a field

### Stories (Content)
- `list_stories` — List stories for a site
- `get_story` — Get story (shallow by default, `full=true` for nested block content)
- `create_story` — Create a new story with auto-enriched blocks
- `update_story` — Update story slug, title, or componentId
- `update_story_content` — Replace entire content for a language
- `delete_story` — Delete a story

### Blocks
- `add_block` — Add a block at a position (start, end, before/after another block)
- `update_block` — Replace a block's content by ID
- `remove_block` — Delete a block by ID
- `move_block` — Reorder a block within a story

### Assets
- `list_assets` — List uploaded assets (images, files) for a site
- `upload_asset` — Upload a file from disk to a site

### Languages
- `list_languages` — List enabled languages
- `add_language` — Add a language to a site
- `remove_language` — Remove a language (deletes all content for that language)

### Auth
- `logout` — Clear stored token

## Token format

Personal access tokens use the format: `zwpat_{uuid}_{secret}`

Tokens are:
- Scoped to the user's organization
- Stored with scrypt-hashed secrets (plaintext never persisted server-side)
- Revocable from the Zeitword dashboard
- Tracked with `lastUsedAt` timestamps
