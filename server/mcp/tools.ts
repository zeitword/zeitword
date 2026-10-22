import { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { MAX_UPLOAD_BYTES } from "./asset-source"
import { patchInput, object, fieldKey } from "./content"
import { componentMetadata, schemaFields } from "./schema"
import { ContentError, ContentStore } from "./store"

export const contentWriteTools = new Set([
  "create_site",
  "create_component",
  "update_component",
  "import_asset",
  "upload_asset",
  "patch_story_content",
  "create_story",
  "update_story",
  "delete_story",
  "update_asset"
])
const siteId = z.uuid().describe("Site UUID returned by list_sites")
const storyId = z.uuid().describe("Story UUID returned by list_stories or search_content")
const expectedRevision = z
  .string()
  .min(1)
  .describe("Revision from the latest get_story; reread and reconcile on conflict")
const locale = z.string().min(2).max(16)
const content = z.record(fieldKey, z.json())
const slug = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/,
    "Use lowercase slug segments separated by hyphens or slashes"
  )

export function registerContentTools(server: McpServer, store: ContentStore, canWrite: boolean) {
  function tool<T extends z.ZodRawShape>(
    name: string,
    description: string,
    input: T,
    run: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
  ) {
    const write = contentWriteTools.has(name)
    server.registerTool(
      name,
      {
        description,
        inputSchema: z.object(input),
        annotations: { readOnlyHint: !write, destructiveHint: write, openWorldHint: false }
      },
      async (args) => {
        try {
          if (write && !canWrite)
            throw new ContentError("FORBIDDEN", "This operation requires mcp:write authorization")
          const structuredContent = { data: await run(args as z.infer<z.ZodObject<T>>) }
          return {
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }]
          }
        } catch (error) {
          let pgError: any = error
          for (let i = 0; i < 5 && pgError?.cause; i++) pgError = pgError.cause
          const failure =
            error instanceof ContentError
              ? error
              : pgError?.code === "23505"
                ? new ContentError(
                    "CONFLICT",
                    "A record with this ID or slug already exists. Inspect it before retrying."
                  )
                : new ContentError("REQUEST_FAILED", "Content operation failed")
          if (failure.code === "REQUEST_FAILED")
            console.error("MCP content operation failed", error)
          const structuredContent = {
            error: {
              code: failure.code,
              message: failure.message,
              retryable: false,
              ...(failure.details ? { details: failure.details } : {})
            }
          }
          return {
            isError: true,
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }]
          }
        }
      }
    )
  }
  tool(
    "create_site",
    "Create a site in an accessible workspace and enable its default language atomically. Supply a new UUID; after a timeout, inspect that ID with get_site before retrying. Default language must be a supported language code.",
    {
      workspaceId: z.uuid().describe("Workspace UUID returned by list_workspaces"),
      id: z.uuid().describe("Client-generated UUID for the new site"),
      name: z.string().trim().min(1).max(255),
      domain: z.string().max(255).optional(),
      defaultLanguage: locale.default("en")
    },
    (args) => store.createSite(args)
  )
  tool(
    "get_story",
    "Read a story with its revision and editor URL. full=true returns the complete content tree; use it before editing. language restricts output to one stored locale, without fallback.",
    { siteId, storyId, language: locale.optional(), full: z.boolean().default(false) },
    async ({ siteId, storyId, language, full }) => {
      const story = await store.getStory(siteId, storyId)
      let value = object(story.content) ? story.content : {}
      if (language) value = Object.hasOwn(value, language) ? { [language]: value[language] } : {}
      if (!full) {
        for (const data of Object.values(value)) {
          if (!object(data)) continue
          for (const [key, item] of Object.entries(data)) {
            if (Array.isArray(item))
              data[key] = item.map((block) =>
                object(block) && block.componentId
                  ? {
                      id: block.id,
                      componentId: block.componentId,
                      componentName: block.componentName,
                      order: block.order
                    }
                  : block
              )
          }
        }
      }
      return { ...story, content: value }
    }
  )
  tool(
    "list_components",
    "List active component schemas, fields, field options and block whitelists for a site. Inspect before creating or editing content.",
    { siteId },
    ({ siteId }) => store.listComponents(siteId)
  )
  tool(
    "create_component",
    "Create a component and its fields/options atomically. Component and option IDs must be client-generated UUIDs; fieldKey is the stable field identity. Block whitelists use existing component names in this site (self-reference allowed). Identical retries return the existing component; changed inputs or duplicate names return CONFLICT. Inspect get_component after a timeout.",
    { siteId, id: z.uuid(), ...componentMetadata.shape, fields: schemaFields.default([]) },
    ({ siteId, ...input }) => store.writeComponent(siteId, input)
  )
  tool(
    "update_component",
    "Update component metadata and/or REPLACE its entire fields array atomically using expectedRevision from get_component. Omitted fields preserves fields; supplied fields replaces all fields/options, so include everything to keep. Preserve option UUIDs and fieldKeys. Does not migrate existing story content. Reread and reconcile on CONFLICT.",
    {
      siteId,
      componentId: z.uuid(),
      expectedRevision: z.string().min(1),
      ...componentMetadata.partial().shape,
      fields: schemaFields.optional()
    },
    ({ siteId, componentId, ...input }) =>
      store.writeComponent(siteId, { id: componentId, ...input })
  )
  tool(
    "get_component",
    "Read a component schema, fields/options and revision. Read before update_component and pass its revision as expectedRevision.",
    { siteId, componentId: z.uuid() },
    async ({ siteId, componentId }) => {
      const schema = (await store.listComponents(siteId)).find((s) => s.id === componentId)
      if (!schema) throw new ContentError("NOT_FOUND", "Component not found in this site")
      return schema
    }
  )
  tool("list_languages", "List enabled content languages for a site.", { siteId }, ({ siteId }) =>
    store.listLanguages(siteId)
  )
  tool(
    "search_content",
    "Search all folders by title, slug or serialized content. Returns paginated summaries, optionally filtered by root component.",
    {
      siteId,
      query: z.string().max(500).optional(),
      componentId: z.uuid().optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(25)
    },
    ({ siteId, ...input }) => store.search(siteId, input)
  )
  tool(
    "patch_story_content",
    "Atomically apply validated edits to ONE locale using expectedRevision from get_story. Paths use field names and {blockId} selectors. Supports set/unset and insert_block/remove_block/move_block. Insert IDs must be client-generated UUIDs. Other locales are preserved. dryRun validates without saving. On CONFLICT reread and reconcile; never blindly retry.",
    { siteId, storyId, ...patchInput.shape },
    ({ siteId, storyId, ...input }) => store.patch(siteId, storyId, input)
  )
  tool(
    "validate_story",
    "Validate stored or proposed locale content against the current site schemas and site-scoped references. Does not save changes.",
    { siteId, storyId, language: locale, content: content.optional() },
    ({ siteId, storyId, language, content }) => store.validate(siteId, storyId, language, content)
  )
  tool(
    "create_story",
    "Create a schema-validated story. Supply a stable client-generated UUID as id so a lost response cannot silently create a second story. Content is keyed by enabled language code; block IDs must also be UUIDs. Inspect an existing ID/slug after a timeout rather than retrying with a new ID.",
    {
      siteId,
      id: z.uuid(),
      title: z.string().min(1).max(255),
      slug,
      componentId: z.uuid(),
      content: z.record(locale, content)
    },
    ({ siteId, ...input }) => store.create(siteId, input)
  )
  tool(
    "update_story",
    "Update story title or slug with optimistic concurrency. Does not change content or the root component.",
    {
      siteId,
      storyId,
      expectedRevision,
      title: z.string().min(1).max(255).optional(),
      slug: slug.optional()
    },
    ({ siteId, storyId, expectedRevision, ...input }) =>
      store.update(siteId, storyId, expectedRevision, input)
  )
  tool(
    "delete_story",
    "Soft-delete one story using its current revision. Does not delete folders or their descendants.",
    { siteId, storyId, expectedRevision },
    ({ siteId, storyId, expectedRevision }) => store.delete(siteId, storyId, expectedRevision)
  )
  tool(
    "get_translation_status",
    "Report stored locales and top-level fields missing relative to the source locale. Does not infer translation quality or use fallback content.",
    { siteId, storyId, sourceLanguage: locale },
    async ({ siteId, storyId, sourceLanguage }) => {
      const [story, languages] = await Promise.all([
        store.getStory(siteId, storyId),
        store.listLanguages(siteId)
      ])
      if (!object(story.content) || !object(story.content[sourceLanguage]))
        throw new ContentError("VALIDATION", "Source locale has no stored content")
      const content = story.content
      const keys = Object.keys(content[sourceLanguage])
      return {
        sourceLanguage,
        locales: languages.map((l) => ({
          language: l.code,
          exists: Object.hasOwn(content, l.code),
          missingFields: keys.filter(
            (k) => content[l.code]?.[k] == null || content[l.code]?.[k] === ""
          )
        }))
      }
    }
  )
  tool(
    "list_assets",
    "List active assets in a site. Paginated; use returned IDs and URLs in content asset fields.",
    {
      siteId,
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(25)
    },
    ({ siteId, offset, limit }) => store.listAssets(siteId, offset, limit)
  )
  tool(
    "get_asset",
    "Read an asset, including URL, filename, MIME type and size.",
    { siteId, assetId: z.uuid() },
    ({ siteId, assetId }) => store.asset(siteId, assetId)
  )
  const assetInput = {
    siteId,
    id: z
      .uuid()
      .describe("Stable client-generated asset UUID; retries must reuse the same ID and inputs"),
    fileName: z.string().min(1).max(255),
    contentType: z
      .string()
      .max(255)
      .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/)
  }
  tool(
    "import_asset",
    "Download a public HTTP(S) URL to this site's asset storage (max 50 MiB, 30-second download, up to 3 redirects). Returns asset ID, src URL and metadata. Private-network URLs and URL credentials are rejected. Exact retries return the existing asset; reuse the same ID and inputs after timeouts. Optional contentType overrides the source MIME type.",
    { ...assetInput, contentType: assetInput.contentType.optional(), url: z.url().max(8192) },
    ({ siteId, ...input }) => store.createAsset(siteId, input)
  )
  tool(
    "upload_asset",
    "Upload base64-encoded file bytes (max 8 MiB decoded; standard padded base64, no data URL prefix). Returns asset ID, src URL and metadata. Exact retries are idempotent; changed inputs with the same ID return CONFLICT. Prefer import_asset for larger files available at a public URL.",
    {
      ...assetInput,
      base64: z
        .string()
        .min(4)
        .max(4 * Math.ceil(MAX_UPLOAD_BYTES / 3))
    },
    ({ siteId, ...input }) => store.createAsset(siteId, input)
  )
  tool(
    "update_asset",
    "Rename an asset's filename metadata. Does not change file contents or storage URL. Alt text belongs in story content; edit it with patch_story_content.",
    { siteId, assetId: z.uuid(), fileName: z.string().min(1).max(255) },
    ({ siteId, assetId, fileName }) => store.asset(siteId, assetId, fileName)
  )
}
