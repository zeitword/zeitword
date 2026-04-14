#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { LexoRank } from "lexorank"
import fs from "fs"
import path from "path"
import { ZeitwordApi } from "./api.js"
import { getStoredToken, authenticateViaBrowser, clearStoredToken } from "./auth.js"

const API_URL = process.env.ZEITWORD_API_URL || "https://app.zeitword.com"

async function getApi(): Promise<ZeitwordApi> {
  // First check for token in env (for CI / non-interactive use)
  const envToken = process.env.ZEITWORD_TOKEN
  if (envToken) {
    return new ZeitwordApi(API_URL, envToken)
  }

  // Check for stored token
  let token = getStoredToken(API_URL)
  if (token) {
    return new ZeitwordApi(API_URL, token)
  }

  // No token found — initiate browser auth
  console.error("No Zeitword token found. Starting browser authorization...")
  token = await authenticateViaBrowser(API_URL)
  return new ZeitwordApi(API_URL, token)
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

async function main() {
  const api = await getApi()

  const server = new McpServer({
    name: "zeitword",
    version: "0.1.0"
  })

  // ── Sites ──────────────────────────────────────────────────────────

  server.registerTool(
    "list_sites",
    {
      description: "List all sites in the organization",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => {
      const sites = await api.listSites()
      return textResult(formatJson(sites))
    }
  )

  server.registerTool(
    "get_site",
    {
      description: "Get details of a specific site",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId }) => {
      const site = await api.getSite(siteId)
      return textResult(formatJson(site))
    }
  )

  server.registerTool(
    "create_site",
    {
      description: "Create a new site",
      inputSchema: {
        name: z.string().describe("Display name for the site"),
        domain: z.string().optional().describe("Domain name (e.g., example.com)"),
        defaultLanguage: z
          .string()
          .optional()
          .describe('Default language code (e.g., "en", "de"). Defaults to "en"')
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ name, domain, defaultLanguage }) => {
      const site = await api.createSite({ name, domain, defaultLanguage })
      return textResult(formatJson(site))
    }
  )

  server.registerTool(
    "update_site",
    {
      description: "Update a site's name, domain, or default language",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        name: z.string().optional().describe("New display name"),
        domain: z.string().optional().describe("New domain name"),
        defaultLanguage: z.string().optional().describe('New default language code (e.g., "de", "en"). Must be a language already added to the site.')
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, name, domain, defaultLanguage }) => {
      const site = await api.updateSite(siteId, { name, domain, defaultLanguage })
      return textResult(formatJson(site))
    }
  )

  server.registerTool(
    "delete_site",
    {
      description: "Delete a site. This is irreversible.",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site to delete")
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId }) => {
      await api.deleteSite(siteId)
      return textResult("Site deleted successfully")
    }
  )

  // ── Components (schemas) ───────────────────────────────────────────

  server.registerTool(
    "list_components",
    {
      description:
        "List all components (content types/block schemas) for a site. Components define the structure of content — like 'page', 'hero-1', 'cards-1', etc.",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId }) => {
      const components = await api.listComponents(siteId)
      return textResult(formatJson(components))
    }
  )

  server.registerTool(
    "get_component",
    {
      description: "Get a component with all its fields and field options",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId, componentId }) => {
      const component = await api.getComponent(siteId, componentId)
      return textResult(formatJson(component))
    }
  )

  server.registerTool(
    "create_component",
    {
      description:
        'Create a new component (content type). For example: name="hero-1", displayName="Hero Block 1"',
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        name: z
          .string()
          .describe(
            'Machine-readable name (e.g., "page", "hero-1", "d-button"). Must be unique per site.'
          ),
        displayName: z.string().describe('Human-readable name (e.g., "Hero Block 1")'),
        previewField: z
          .string()
          .optional()
          .describe("Which field to use as preview label in the editor")
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ siteId, name, displayName, previewField }) => {
      const component = await api.createComponent(siteId, { name, displayName, previewField })
      api.invalidateComponentCache(siteId)
      return textResult(formatJson(component))
    }
  )

  server.registerTool(
    "update_component",
    {
      description: "Update a component's name, display name, or preview field",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component"),
        name: z.string().optional().describe("New machine-readable name"),
        displayName: z.string().optional().describe("New display name"),
        previewField: z.string().optional().describe("New preview field key")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, componentId, ...data }) => {
      const component = await api.updateComponent(siteId, componentId, data)
      return textResult(formatJson(component))
    }
  )

  server.registerTool(
    "delete_component",
    {
      description: "Delete a component and all its fields. Irreversible.",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component to delete")
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, componentId }) => {
      await api.deleteComponent(siteId, componentId)
      api.invalidateComponentCache(siteId)
      return textResult("Component deleted successfully")
    }
  )

  // ── Component Fields ───────────────────────────────────────────────

  server.registerTool(
    "create_field",
    {
      description: `Add a field to a component. Field types: text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, assets, link, blocks, section, custom.

The "blocks" type is special — it creates a nested array of other components. Use componentWhitelist to restrict which components can be added.

For "option" type fields, provide options as an array of {optionName, optionValue} objects.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component"),
        name: z
          .string()
          .describe('The field key used in content JSON (e.g., "title", "cards", "buttons")'),
        fieldType: z
          .string()
          .describe(
            "Field type: text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, assets, link, blocks, section, custom"
          ),
        order: z.string().optional().describe("LexoRank order string. Auto-generated if not provided."),
        displayName: z.string().describe('Human-readable name (e.g., "Title", "Cards")')
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ siteId, componentId, order, ...data }) => {
      // Auto-generate LexoRank order if not provided
      let fieldOrder = order
      if (!fieldOrder) {
        const component = await api.getComponent(siteId, componentId)
        const fields = component.fields || []
        if (fields.length === 0) {
          fieldOrder = LexoRank.min().genNext().toString()
        } else {
          const sorted = [...fields].sort((a: any, b: any) => (a.order ?? "").localeCompare(b.order ?? ""))
          const lastOrder = sorted[sorted.length - 1].order
          try {
            fieldOrder = LexoRank.parse(lastOrder).genNext().toString()
          } catch {
            fieldOrder = LexoRank.min().genNext().toString()
          }
        }
      }
      const field = await api.createField(siteId, componentId, { ...data, order: fieldOrder })
      return textResult(formatJson(field))
    }
  )

  server.registerTool(
    "update_field",
    {
      description: `Update a field on a component. Can update the field key, type, display name, required flag, description, default value, component whitelist (for blocks type), and options (for option type).`,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component"),
        fieldKey: z.string().describe("The current field key to update"),
        newFieldKey: z.string().optional().describe("New field key if renaming"),
        fieldType: z.string().optional().describe("New field type"),
        displayName: z.string().optional().describe("New display name"),
        required: z.boolean().optional().describe("Whether the field is required"),
        description: z.string().optional().describe("Help text for editors"),
        defaultValue: z.string().optional().describe("Default value"),
        componentWhitelist: z.array(z.string()).optional().describe("Allowed nested component names"),
        options: z
          .array(
            z.object({
              optionName: z.string(),
              optionValue: z.string()
            })
          )
          .optional()
          .describe("Options for option fields")
      }
    },
    async ({ siteId, componentId, fieldKey, newFieldKey, ...data }) => {
      const body = { ...data, ...(newFieldKey ? { fieldKey: newFieldKey } : {}) }
      const field = await api.updateField(siteId, componentId, fieldKey, body)
      return textResult(formatJson(field))
    }
  )

  server.registerTool(
    "delete_field",
    {
      description: "Delete a field from a component",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        componentId: z.string().describe("The UUID of the component"),
        fieldKey: z.string().describe("The field key to delete")
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, componentId, fieldKey }) => {
      await api.deleteField(siteId, componentId, fieldKey)
      return textResult("Field deleted successfully")
    }
  )

  // ── Schema Upsert ──────────────────────────────────────────────────

  server.registerTool(
    "upsert_component_schema",
    {
      description: `Create or update a component and all its fields in a single call. Idempotent — safe to call repeatedly with the same definition.

Behavior:
- If a component with the given name does not exist, it is created along with all fields.
- If it already exists, the component metadata is updated if changed, then fields are diffed:
  - Fields in the definition but not on the component are created.
  - Fields in both are updated.
  - Fields on the component but not in the definition are deleted ONLY if removeExtraFields is true (default: false).
- Field order follows the array order in the definition (auto-generated LexoRank).

Returns the full component with all fields after the upsert.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        name: z.string().describe('Machine-readable component name (e.g., "hero-1", "page")'),
        displayName: z.string().describe('Human-readable name (e.g., "Hero Block 1")'),
        previewField: z.string().optional().describe("Which field to use as preview label"),
        fields: z
          .array(
            z.object({
              name: z.string().describe("Field key"),
              fieldType: z.string().describe("Field type (text, textarea, richtext, blocks, etc.)"),
              displayName: z.string().describe("Human-readable field name"),
              required: z.boolean().optional().describe("Whether the field is required"),
              description: z.string().optional().describe("Help text for editors"),
              defaultValue: z.string().optional().describe("Default value"),
              componentWhitelist: z
                .array(z.string())
                .optional()
                .describe("Allowed nested component names (for blocks type)"),
              options: z
                .array(z.object({ optionName: z.string(), optionValue: z.string() }))
                .optional()
                .describe("Options for option/options type fields")
            })
          )
          .describe("Array of field definitions. Order in the array determines field order."),
        removeExtraFields: z
          .boolean()
          .optional()
          .describe(
            "If true, fields on the component that are not in the definition will be deleted. Default: false."
          )
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, name, displayName, previewField, fields, removeExtraFields }) => {
      const log: string[] = []

      // 1. Find or create the component
      const existingComponents = await api.listComponents(siteId)
      let component = existingComponents.find((c: any) => c.name === name)

      if (!component) {
        component = await api.createComponent(siteId, { name, displayName, previewField })
        log.push(`Created component "${name}" (${component.id})`)
      } else {
        // Update metadata if changed
        const updates: Record<string, string> = {}
        if (displayName !== component.displayName) updates.displayName = displayName
        if (previewField !== undefined && previewField !== component.previewField)
          updates.previewField = previewField
        if (Object.keys(updates).length > 0) {
          component = await api.updateComponent(siteId, component.id, updates)
          log.push(`Updated component metadata: ${Object.keys(updates).join(", ")}`)
        } else {
          log.push(`Component "${name}" already exists, metadata unchanged`)
        }
      }

      // 2. Get current fields (API returns fieldKey/type, not name/fieldType)
      const fullComponent = await api.getComponent(siteId, component.id)
      const existingFields: any[] = fullComponent.fields || []
      const existingFieldMap = new Map(existingFields.map((f: any) => [f.fieldKey, f]))
      const definedFieldNames = new Set(fields.map((f) => f.name))

      // 3. Generate LexoRank order sequence for all fields
      let rank = LexoRank.min().genNext()
      const fieldOrders: string[] = []
      for (let i = 0; i < fields.length; i++) {
        fieldOrders.push(rank.toString())
        rank = rank.genNext()
      }

      // 4. Create or update fields
      for (let i = 0; i < fields.length; i++) {
        const fieldDef = fields[i]
        const existing = existingFieldMap.get(fieldDef.name)

        if (!existing) {
          // Create new field
          await api.createField(siteId, component.id, {
            name: fieldDef.name,
            fieldType: fieldDef.fieldType,
            displayName: fieldDef.displayName,
            order: fieldOrders[i]
          })
          log.push(`Created field "${fieldDef.name}"`)

          // If there are extra properties (required, description, componentWhitelist, options), update
          const extras: Record<string, any> = {}
          if (fieldDef.required !== undefined) extras.required = fieldDef.required
          if (fieldDef.description !== undefined) extras.description = fieldDef.description
          if (fieldDef.defaultValue !== undefined) extras.defaultValue = fieldDef.defaultValue
          if (fieldDef.componentWhitelist !== undefined)
            extras.componentWhitelist = fieldDef.componentWhitelist
          if (fieldDef.options !== undefined) extras.options = fieldDef.options
          if (Object.keys(extras).length > 0) {
            await api.updateField(siteId, component.id, fieldDef.name, extras)
          }
        } else {
          // Update existing field (API returns `type` not `fieldType`)
          const updates: Record<string, any> = {}
          if (fieldDef.fieldType !== existing.type) updates.fieldType = fieldDef.fieldType
          if (fieldDef.displayName !== existing.displayName)
            updates.displayName = fieldDef.displayName
          if (fieldDef.required !== undefined && fieldDef.required !== existing.required)
            updates.required = fieldDef.required
          if (fieldDef.description !== undefined && fieldDef.description !== existing.description)
            updates.description = fieldDef.description
          if (fieldDef.defaultValue !== undefined && fieldDef.defaultValue !== existing.defaultValue)
            updates.defaultValue = fieldDef.defaultValue
          if (fieldDef.componentWhitelist !== undefined)
            updates.componentWhitelist = fieldDef.componentWhitelist
          if (fieldDef.options !== undefined) updates.options = fieldDef.options

          // Update order only if it changed
          if (fieldOrders[i] !== existing.order) updates.order = fieldOrders[i]

          if (Object.keys(updates).length > 0) {
            await api.updateField(siteId, component.id, fieldDef.name, updates)
            log.push(`Updated field "${fieldDef.name}"`)
          } else {
            log.push(`Field "${fieldDef.name}" unchanged`)
          }
        }
      }

      // 5. Remove extra fields if requested
      if (removeExtraFields) {
        for (const existing of existingFields) {
          if (!definedFieldNames.has(existing.fieldKey)) {
            await api.deleteField(siteId, component.id, existing.fieldKey)
            log.push(`Deleted extra field "${existing.fieldKey}"`)
          }
        }
      }

      // 6. Invalidate component cache so enrichment picks up any new components
      api.invalidateComponentCache(siteId)

      // 7. Return the final state
      const result = await api.getComponent(siteId, component.id)
      return textResult(
        formatJson({
          summary: log,
          component: result
        })
      )
    }
  )

  // ── Assets ──────────────────────────────────────────────────────────

  server.registerTool(
    "list_assets",
    {
      description: "List uploaded assets (images, files) for a site. Returns paginated results.",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        search: z.string().optional().describe("Search by file name"),
        type: z
          .string()
          .optional()
          .describe('Filter by asset type: "image", "video", "audio", "pdf", "other"')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId, search, type }) => {
      const result = await api.listAssets(siteId, { search, type })
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "upload_asset",
    {
      description: `Upload a file from disk to a Zeitword site as an asset. Reads the file, uploads it via S3 multipart upload, and persists the asset record.

Returns the asset with its public URL (src), which can be used in content fields of type "asset".`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        filePath: z
          .string()
          .describe("Absolute path to the file on disk to upload")
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ siteId, filePath: inputPath }) => {
      // Resolve and validate the file path
      const resolvedPath = path.resolve(inputPath)
      if (!fs.existsSync(resolvedPath)) {
        return textResult(`Error: File not found: ${resolvedPath}`)
      }

      const stat = fs.statSync(resolvedPath)
      if (!stat.isFile()) {
        return textResult(`Error: Not a file: ${resolvedPath}`)
      }

      const fileName = path.basename(resolvedPath)
      const fileSize = stat.size

      // Determine content type from extension
      const ext = path.extname(fileName).toLowerCase()
      const mimeTypes: Record<string, string> = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".ico": "image/x-icon",
        ".pdf": "application/pdf",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".json": "application/json",
        ".css": "text/css",
        ".js": "application/javascript",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".otf": "font/otf"
      }
      const contentType = mimeTypes[ext] || "application/octet-stream"

      // Step 1: Create the multipart upload
      const upload = await api.createUpload(fileName, fileSize, contentType)

      // Step 2: Read the file and upload each part
      const fileBuffer = fs.readFileSync(resolvedPath)
      const parts: { partNumber: number; etag: string }[] = []

      for (let i = 0; i < upload.totalParts; i++) {
        const start = i * upload.partSize
        const end = Math.min(start + upload.partSize, fileSize)
        const chunk = fileBuffer.subarray(start, end)

        const res = await fetch(upload.urls[i].url, {
          method: "PUT",
          body: chunk,
          headers: {
            "Content-Length": String(chunk.length)
          }
        })

        const etag = res.headers.get("etag")
        if (!etag) {
          return textResult(`Error: S3 did not return ETag for part ${i + 1}`)
        }

        parts.push({ partNumber: i + 1, etag })
      }

      // Step 3: Complete the upload
      const asset = await api.completeUpload({
        key: upload.key,
        uploadId: upload.uploadId,
        fileName,
        fileSize,
        contentType,
        siteId,
        parts
      })

      return textResult(formatJson(asset))
    }
  )

  // ── Stories (content) ──────────────────────────────────────────────

  server.registerTool(
    "list_stories",
    {
      description: "List stories (pages/content entries) for a site",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        search: z.string().optional().describe("Search query to filter stories by title or slug")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId, search }) => {
      const stories = await api.listStories(siteId, { search })
      return textResult(formatJson(stories))
    }
  )

  server.registerTool(
    "get_story",
    {
      description: `Get a story with its content and component details.

By default returns a shallow view: block summaries with id, componentName, componentId, and order — but no nested block content. This is sufficient for listing blocks, reordering, or targeting specific blocks for updates.

Set full=true to retrieve the complete content tree including all nested block content. Only use this when you need to read the actual field values inside blocks.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        full: z.boolean().optional().describe("If true, returns full nested block content. Default: false (shallow — block summaries only)")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, full }) => {
      const story = await api.getStory(siteId, storyId, { full: full ?? false })
      return textResult(formatJson(story))
    }
  )

  server.registerTool(
    "create_story",
    {
      description: `Create a new story (page or content entry).

Content is a JSON object keyed by language code. Language codes must match languages enabled on the site (use list_languages to check). Each block in the content has:
- componentId: UUID of the component type
- content: object with field values matching the component's schema
- order: string for ordering using LexoRank format (e.g., "0|100000:", "0|100008:", "0|10000g:")

Auto-enrichment: You do NOT need to provide \`id\`, \`componentName\`, or \`order\` on blocks — these are auto-generated. You only need \`componentId\` and \`content\`.

Example content for a site with default language "de":
{
  "de": {
    "title": "Startseite",
    "blocks": [
      {
        "componentId": "uuid-of-hero-component",
        "content": { "title": "Willkommen", "description": "..." }
      }
    ]
  }
}`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        slug: z
          .string()
          .describe(
            'URL slug (e.g., "index" for homepage, "about", "blog/my-post"). Lowercase, hyphens and slashes only.'
          ),
        title: z.string().describe("Title of the story"),
        type: z
          .enum(["story", "folder"])
          .optional()
          .describe('"story" (default) for content pages, "folder" for grouping'),
        content: z
          .record(z.any())
          .optional()
          .describe("Content object keyed by language code (e.g., { en: { ... } })"),
        componentId: z
          .string()
          .optional()
          .describe("UUID of the component type this story uses")
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ siteId, ...data }) => {
      const story = await api.createStory(siteId, data)
      return textResult(formatJson(story))
    }
  )

  server.registerTool(
    "update_story",
    {
      description: `Update a story's slug, title, or componentId. Does NOT modify content — use update_story_content, add_block, update_block, or remove_block for content changes.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        slug: z.string().optional().describe("New URL slug"),
        title: z.string().optional().describe("New title"),
        componentId: z.string().optional().describe("UUID of the component type this story uses")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, ...data }) => {
      await api.updateStory(siteId, storyId, data)
      return textResult(formatJson({ success: true, storyId }))
    }
  )

  server.registerTool(
    "update_story_content",
    {
      description: `Replace the entire content for a specific language in a story. This is a full replacement — the previous content for that language is discarded. Other languages are preserved.

Use this to set up a page's full block structure in one call. For targeted edits to individual blocks, prefer add_block, update_block, or remove_block.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        language: z.string().describe('Language code (e.g., "en", "de")'),
        content: z.record(z.any()).describe("Full content object for this language (e.g., { title: \"...\", blocks: [...] })")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, language, content }) => {
      const result = await api.updateStoryContent(siteId, storyId, language, content)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "add_block",
    {
      description: `Add a new block to a story at a specified position. Auto-generates id, componentName, and order.

Position options:
- "end" (default): Add at the end of the blocks array
- "start": Add at the beginning
- "before:blockId": Add before a specific existing block
- "after:blockId": Add after a specific existing block`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        language: z.string().describe('Language code (e.g., "en", "de")'),
        componentId: z.string().describe("UUID of the component type for this block"),
        content: z.record(z.any()).describe("Block content matching the component's schema"),
        position: z
          .string()
          .optional()
          .describe('Where to insert: "end" (default), "start", "before:blockId", "after:blockId"')
      },
      annotations: { destructiveHint: false, openWorldHint: false }
    },
    async ({ siteId, storyId, language, componentId, content, position }) => {
      const result = await api.addBlock(siteId, storyId, language, { componentId, content }, position)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "update_block",
    {
      description: `Update a specific block's content by its ID. This replaces the block's content entirely — provide the full content object, not a partial merge.

Use get_story to find block IDs in the story content.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        language: z.string().describe('Language code (e.g., "en", "de")'),
        blockId: z.string().describe("The ID of the block to update"),
        content: z.record(z.any()).describe("New content for the block (full replacement, not merge)")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, language, blockId, content }) => {
      const result = await api.updateBlock(siteId, storyId, language, blockId, content)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "remove_block",
    {
      description: `Remove a block from a story by its ID. The block and all its content is permanently deleted.

Use get_story to find block IDs in the story content.`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        language: z.string().describe('Language code (e.g., "en", "de")'),
        blockId: z.string().describe("The ID of the block to remove")
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, language, blockId }) => {
      const result = await api.removeBlock(siteId, storyId, language, blockId)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "move_block",
    {
      description: `Move a block to a new position within the same story. Reorders the block and regenerates LexoRank order values.

Position options:
- "start": Move to the beginning
- "end": Move to the end
- "before:blockId": Move before a specific block
- "after:blockId": Move after a specific block`,
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story"),
        language: z.string().describe('Language code (e.g., "en", "de")'),
        blockId: z.string().describe("The ID of the block to move"),
        position: z
          .string()
          .describe('Target position: "start", "end", "before:blockId", "after:blockId"')
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId, language, blockId, position }) => {
      const result = await api.moveBlock(siteId, storyId, language, blockId, position)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "delete_story",
    {
      description: "Delete a story",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        storyId: z.string().describe("The UUID of the story to delete")
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, storyId }) => {
      await api.deleteStory(siteId, storyId)
      return textResult("Story deleted successfully")
    }
  )

  // ── Languages ──────────────────────────────────────────────────────

  server.registerTool(
    "list_languages",
    {
      description: "List languages enabled for a site",
      inputSchema: {
        siteId: z.string().describe("The UUID of the site")
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ siteId }) => {
      const languages = await api.listLanguages(siteId)
      return textResult(formatJson(languages))
    }
  )

  server.registerTool(
    "add_language",
    {
      description: 'Add a language to a site (e.g., "de" for German, "fr" for French)',
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        languageCode: z.string().describe('ISO 639-1 language code (e.g., "de", "fr", "es")')
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, languageCode }) => {
      const result = await api.addLanguage(siteId, languageCode)
      return textResult(formatJson(result))
    }
  )

  server.registerTool(
    "remove_language",
    {
      description: 'Remove a language from a site. This deletes all content for that language from every story in the site. Cannot remove the default language — change the default first using update_site.',
      inputSchema: {
        siteId: z.string().describe("The UUID of the site"),
        languageCode: z.string().describe('ISO 639-1 language code to remove (e.g., "en", "fr")')
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ siteId, languageCode }) => {
      const result = await api.removeLanguage(siteId, languageCode)
      return textResult(formatJson(result))
    }
  )

  // ── Auth ───────────────────────────────────────────────────────────

  server.registerTool(
    "logout",
    {
      description: "Clear stored Zeitword authentication token",
      inputSchema: {},
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async () => {
      clearStoredToken()
      return textResult(
        "Token cleared. The MCP server will need to be restarted to re-authenticate."
      )
    }
  )

  // ── Start server ───────────────────────────────────────────────────

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Zeitword MCP server running on stdio")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
