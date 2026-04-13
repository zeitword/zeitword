# @zeitword/mcp

MCP (Model Context Protocol) server for Zeitword CMS. Allows AI assistants to manage sites, content, and schemas.

## Setup

```bash
cd packages/mcp
bun install
bun run build
```

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

### Environment variables

- `ZEITWORD_API_URL` — Override the API URL (default: `https://app.zeitword.com`)
- `ZEITWORD_TOKEN` — Pre-set a personal access token (skips browser auth)

## Available Tools

### Sites
- `list_sites` — List all sites in the organization
- `get_site` — Get site details
- `create_site` — Create a new site
- `update_site` — Update site name/domain
- `delete_site` — Delete a site

### Components (Schemas)
- `list_components` — List all component schemas for a site
- `get_component` — Get component with fields
- `create_component` — Create a new component
- `update_component` — Update a component
- `delete_component` — Delete a component

### Fields
- `create_field` — Add a field to a component
- `update_field` — Update a field
- `delete_field` — Delete a field

### Stories (Content)
- `list_stories` — List stories for a site
- `get_story` — Get story with full content
- `create_story` — Create a new story
- `update_story` — Update story content
- `delete_story` — Delete a story

### Languages
- `list_languages` — List enabled languages
- `add_language` — Add a language to a site

### Auth
- `logout` — Clear stored token

## Token format

Personal access tokens use the format: `zwpat_{uuid}_{secret}`

Tokens are:
- Scoped to the user's organization
- Stored with scrypt-hashed secrets (plaintext never persisted server-side)
- Revocable from the Zeitword dashboard
- Tracked with `lastUsedAt` timestamps
