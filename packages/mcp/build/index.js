#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LexoRank } from "lexorank";
import { ZeitwordApi } from "./api.js";
import { getStoredToken, authenticateViaBrowser, clearStoredToken } from "./auth.js";
const API_URL = process.env.ZEITWORD_API_URL || "https://app.zeitword.com";
async function getApi() {
    // First check for token in env (for CI / non-interactive use)
    const envToken = process.env.ZEITWORD_TOKEN;
    if (envToken) {
        return new ZeitwordApi(API_URL, envToken);
    }
    // Check for stored token
    let token = getStoredToken(API_URL);
    if (token) {
        return new ZeitwordApi(API_URL, token);
    }
    // No token found — initiate browser auth
    console.error("No Zeitword token found. Starting browser authorization...");
    token = await authenticateViaBrowser(API_URL);
    return new ZeitwordApi(API_URL, token);
}
function formatJson(data) {
    return JSON.stringify(data, null, 2);
}
function textResult(text) {
    return { content: [{ type: "text", text }] };
}
async function main() {
    const api = await getApi();
    const server = new McpServer({
        name: "zeitword",
        version: "0.1.0"
    });
    // ── Sites ──────────────────────────────────────────────────────────
    server.registerTool("list_sites", {
        description: "List all sites in the organization",
        inputSchema: {}
    }, async () => {
        const sites = await api.listSites();
        return textResult(formatJson(sites));
    });
    server.registerTool("get_site", {
        description: "Get details of a specific site",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site")
        }
    }, async ({ siteId }) => {
        const site = await api.getSite(siteId);
        return textResult(formatJson(site));
    });
    server.registerTool("create_site", {
        description: "Create a new site",
        inputSchema: {
            name: z.string().describe("Display name for the site"),
            domain: z.string().optional().describe("Domain name (e.g., example.com)"),
            defaultLanguage: z
                .string()
                .optional()
                .describe('Default language code (e.g., "en", "de"). Defaults to "en"')
        }
    }, async ({ name, domain, defaultLanguage }) => {
        const site = await api.createSite({ name, domain, defaultLanguage });
        return textResult(formatJson(site));
    });
    server.registerTool("update_site", {
        description: "Update a site's name or domain",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            name: z.string().optional().describe("New display name"),
            domain: z.string().optional().describe("New domain name")
        }
    }, async ({ siteId, name, domain }) => {
        const site = await api.updateSite(siteId, { name, domain });
        return textResult(formatJson(site));
    });
    server.registerTool("delete_site", {
        description: "Delete a site. This is irreversible.",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site to delete")
        }
    }, async ({ siteId }) => {
        await api.deleteSite(siteId);
        return textResult("Site deleted successfully");
    });
    // ── Components (schemas) ───────────────────────────────────────────
    server.registerTool("list_components", {
        description: "List all components (content types/block schemas) for a site. Components define the structure of content — like 'page', 'hero-1', 'cards-1', etc.",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site")
        }
    }, async ({ siteId }) => {
        const components = await api.listComponents(siteId);
        return textResult(formatJson(components));
    });
    server.registerTool("get_component", {
        description: "Get a component with all its fields and field options",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            componentId: z.string().describe("The UUID of the component")
        }
    }, async ({ siteId, componentId }) => {
        const component = await api.getComponent(siteId, componentId);
        return textResult(formatJson(component));
    });
    server.registerTool("create_component", {
        description: 'Create a new component (content type). For example: name="hero-1", displayName="Hero Block 1"',
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            name: z
                .string()
                .describe('Machine-readable name (e.g., "page", "hero-1", "d-button"). Must be unique per site.'),
            displayName: z.string().describe('Human-readable name (e.g., "Hero Block 1")'),
            previewField: z
                .string()
                .optional()
                .describe("Which field to use as preview label in the editor")
        }
    }, async ({ siteId, name, displayName, previewField }) => {
        const component = await api.createComponent(siteId, { name, displayName, previewField });
        return textResult(formatJson(component));
    });
    server.registerTool("update_component", {
        description: "Update a component's name, display name, or preview field",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            componentId: z.string().describe("The UUID of the component"),
            name: z.string().optional().describe("New machine-readable name"),
            displayName: z.string().optional().describe("New display name"),
            previewField: z.string().optional().describe("New preview field key")
        }
    }, async ({ siteId, componentId, ...data }) => {
        const component = await api.updateComponent(siteId, componentId, data);
        return textResult(formatJson(component));
    });
    server.registerTool("delete_component", {
        description: "Delete a component and all its fields. Irreversible.",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            componentId: z.string().describe("The UUID of the component to delete")
        }
    }, async ({ siteId, componentId }) => {
        await api.deleteComponent(siteId, componentId);
        return textResult("Component deleted successfully");
    });
    // ── Component Fields ───────────────────────────────────────────────
    server.registerTool("create_field", {
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
                .describe("Field type: text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, assets, link, blocks, section, custom"),
            order: z.string().optional().describe("LexoRank order string. Auto-generated if not provided."),
            displayName: z.string().describe('Human-readable name (e.g., "Title", "Cards")')
        }
    }, async ({ siteId, componentId, order, ...data }) => {
        // Auto-generate LexoRank order if not provided
        let fieldOrder = order;
        if (!fieldOrder) {
            const component = await api.getComponent(siteId, componentId);
            const fields = component.fields || [];
            if (fields.length === 0) {
                fieldOrder = LexoRank.min().genNext().toString();
            }
            else {
                const sorted = [...fields].sort((a, b) => (a.order ?? "").localeCompare(b.order ?? ""));
                const lastOrder = sorted[sorted.length - 1].order;
                try {
                    fieldOrder = LexoRank.parse(lastOrder).genNext().toString();
                }
                catch {
                    fieldOrder = LexoRank.min().genNext().toString();
                }
            }
        }
        const field = await api.createField(siteId, componentId, { ...data, order: fieldOrder });
        return textResult(formatJson(field));
    });
    server.registerTool("update_field", {
        description: `Update a field on a component. Can update the field key, type, display name, required flag, description, default value, component whitelist (for blocks type), and options (for option type).`,
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
                .array(z.object({
                optionName: z.string(),
                optionValue: z.string()
            }))
                .optional()
                .describe("Options for option fields")
        }
    }, async ({ siteId, componentId, fieldKey, newFieldKey, ...data }) => {
        const body = { ...data, ...(newFieldKey ? { fieldKey: newFieldKey } : {}) };
        const field = await api.updateField(siteId, componentId, fieldKey, body);
        return textResult(formatJson(field));
    });
    server.registerTool("delete_field", {
        description: "Delete a field from a component",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            componentId: z.string().describe("The UUID of the component"),
            fieldKey: z.string().describe("The field key to delete")
        }
    }, async ({ siteId, componentId, fieldKey }) => {
        await api.deleteField(siteId, componentId, fieldKey);
        return textResult("Field deleted successfully");
    });
    // ── Stories (content) ──────────────────────────────────────────────
    server.registerTool("list_stories", {
        description: "List stories (pages/content entries) for a site",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            search: z.string().optional().describe("Search query to filter stories by title or slug")
        }
    }, async ({ siteId, search }) => {
        const stories = await api.listStories(siteId, { search });
        return textResult(formatJson(stories));
    });
    server.registerTool("get_story", {
        description: "Get a story with its full content and component details",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            storyId: z.string().describe("The UUID of the story")
        }
    }, async ({ siteId, storyId }) => {
        const story = await api.getStory(siteId, storyId);
        return textResult(formatJson(story));
    });
    server.registerTool("create_story", {
        description: `Create a new story (page or content entry).

Content is a JSON object keyed by language code. Each block in the content has:
- componentId: UUID of the component type
- content: object with field values matching the component's schema
- order: string for ordering using LexoRank format (e.g., "0|100000:", "0|100008:", "0|10000g:")

Example content:
{
  "en": {
    "title": "Homepage",
    "blocks": [
      {
        "componentId": "uuid-of-hero-component",
        "content": { "title": "Welcome", "description": "..." },
        "order": "0|100000:"
      }
    ]
  }
}`,
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            slug: z
                .string()
                .describe('URL slug (e.g., "index" for homepage, "about", "blog/my-post"). Lowercase, hyphens and slashes only.'),
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
        }
    }, async ({ siteId, ...data }) => {
        const story = await api.createStory(siteId, data);
        return textResult(formatJson(story));
    });
    server.registerTool("update_story", {
        description: "Update a story's slug, title, or content. Content updates are merged with existing content.",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            storyId: z.string().describe("The UUID of the story"),
            slug: z.string().optional().describe("New URL slug"),
            title: z.string().optional().describe("New title"),
            content: z.record(z.any()).optional().describe("Content to merge (keyed by language code)")
        }
    }, async ({ siteId, storyId, ...data }) => {
        const story = await api.updateStory(siteId, storyId, data);
        return textResult(formatJson(story));
    });
    server.registerTool("delete_story", {
        description: "Delete a story",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            storyId: z.string().describe("The UUID of the story to delete")
        }
    }, async ({ siteId, storyId }) => {
        await api.deleteStory(siteId, storyId);
        return textResult("Story deleted successfully");
    });
    // ── Languages ──────────────────────────────────────────────────────
    server.registerTool("list_languages", {
        description: "List languages enabled for a site",
        inputSchema: {
            siteId: z.string().describe("The UUID of the site")
        }
    }, async ({ siteId }) => {
        const languages = await api.listLanguages(siteId);
        return textResult(formatJson(languages));
    });
    server.registerTool("add_language", {
        description: 'Add a language to a site (e.g., "de" for German, "fr" for French)',
        inputSchema: {
            siteId: z.string().describe("The UUID of the site"),
            languageCode: z.string().describe('ISO 639-1 language code (e.g., "de", "fr", "es")')
        }
    }, async ({ siteId, languageCode }) => {
        const result = await api.addLanguage(siteId, languageCode);
        return textResult(formatJson(result));
    });
    // ── Auth ───────────────────────────────────────────────────────────
    server.registerTool("logout", {
        description: "Clear stored Zeitword authentication token",
        inputSchema: {}
    }, async () => {
        clearStoredToken();
        return textResult("Token cleared. The MCP server will need to be restarted to re-authenticate.");
    });
    // ── Start server ───────────────────────────────────────────────────
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Zeitword MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
