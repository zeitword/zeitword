import type { JWTPayload } from "jose"

import { McpServer, createMcpHandler } from "@modelcontextprotocol/server"
import { and, eq, isNull, gt } from "drizzle-orm"
import { z } from "zod"

import type { AuthDatabase } from "./auth"

import {
  users,
  sessions,
  organisations,
  organisationMembers,
  sites,
  stories,
  oauthClient,
  oauthConsent
} from "./database/schema"
import { ContentStore } from "./mcp/store"
import { registerContentTools } from "./mcp/tools"

export async function mcpIdentity(
  database: AuthDatabase,
  claims: JWTPayload,
  requiredScopes = ["mcp:read"]
) {
  // OAuth authenticates the identity. Current database state authorizes access.
  if (
    !z.uuid().safeParse(claims.sub).success ||
    !z.uuid().safeParse(claims.sid).success ||
    typeof claims.client_id !== "string"
  )
    return null
  const [user] = await database
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(sessions, and(eq(sessions.userId, users.id), eq(sessions.id, claims.sid as string)))
    .where(
      and(
        eq(users.id, claims.sub!),
        isNull(users.deletedAt),
        eq(users.authVersion, sessions.authVersion),
        gt(sessions.expiresAt, new Date())
      )
    )
  if (!user) return null
  const [client] = await database
    .select()
    .from(oauthClient)
    .where(eq(oauthClient.clientId, claims.client_id))
  if (!client || client.disabled) return null
  const consents = await database
    .select()
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, user.id), eq(oauthConsent.clientId, claims.client_id)))
  if (
    !client.skipConsent &&
    !consents.some((c) => requiredScopes.every((scope) => c.scopes.includes(scope)))
  )
    return null
  return user
}

export function createAccountMcp(
  database: AuthDatabase,
  user: { id: string; name: string; email: string },
  options: { baseURL: string; canWrite: boolean }
) {
  const membershipWhere = and(
    eq(organisationMembers.userId, user.id),
    isNull(organisationMembers.deletedAt),
    isNull(organisations.deletedAt)
  )
  const workspaces = () =>
    database
      .select({ id: organisations.id, name: organisations.name, role: organisationMembers.role })
      .from(organisationMembers)
      .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
      .where(membershipWhere)
  const visibleSites = () =>
    database
      .select({
        id: sites.id,
        name: sites.name,
        domain: sites.domain,
        workspaceId: sites.organisationId,
        defaultLanguage: sites.defaultLanguage
      })
      .from(sites)
      .innerJoin(organisationMembers, eq(organisationMembers.organisationId, sites.organisationId))
      .innerJoin(organisations, eq(organisations.id, sites.organisationId))
  const result = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: { data }
  })
  return createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "zeitword", version: "0.3.0" },
        {
          instructions:
            "Start with list_workspaces, then list_sites with an explicit workspaceId. Every site belongs to a workspace. No active workspace is stored; calls across workspaces can run independently. Inspect component schemas before creating content. Read get_component before update_component and use its revision; a supplied fields array replaces all fields/options. Block whitelists use component names. Import assets from public URLs with import_asset or upload base64 bytes with upload_asset. Read get_story with full=true before editing and use its revision. Patch one locale at a time with stable block IDs. On CONFLICT reread and reconcile; never blindly retry. Never retry creates with new IDs after a timeout. Only current memberships grant access."
        }
      )
      const annotations = { readOnlyHint: true, openWorldHint: false }
      registerContentTools(
        server,
        new ContentStore(database, user.id, options.baseURL),
        options.canWrite
      )
      server.registerTool(
        "get_context",
        {
          description: "Get your connected account and all accessible workspaces",
          inputSchema: z.object({}),
          annotations
        },
        async () => result({ user, workspaces: await workspaces() })
      )
      server.registerTool(
        "list_workspaces",
        {
          description: "List all workspaces you currently belong to and your roles",
          inputSchema: z.object({}),
          annotations
        },
        async () => result(await workspaces())
      )
      server.registerTool(
        "list_sites",
        {
          description: "List active sites in one workspace",
          inputSchema: z.object({ workspaceId: z.uuid() }),
          annotations
        },
        async ({ workspaceId }) => {
          if (!(await workspaces()).some((w) => w.id === workspaceId))
            throw new Error("Workspace not found or access revoked")
          return result(
            await visibleSites().where(
              and(membershipWhere, eq(sites.organisationId, workspaceId), isNull(sites.deletedAt))
            )
          )
        }
      )
      server.registerTool(
        "get_site",
        {
          description: "Read a site and its workspace",
          inputSchema: z.object({ siteId: z.uuid() }),
          annotations
        },
        async ({ siteId }) => {
          const [site] = await visibleSites().where(
            and(membershipWhere, eq(sites.id, siteId), isNull(sites.deletedAt))
          )
          if (!site) throw new Error("Site not found or access revoked")
          return result(site)
        }
      )
      server.registerTool(
        "list_stories",
        {
          description: "List stories in an accessible site",
          inputSchema: z.object({
            siteId: z.uuid(),
            offset: z.number().int().min(0).default(0),
            limit: z.number().int().min(1).max(100).default(25)
          }),
          annotations
        },
        async ({ siteId, offset, limit }) => {
          const [site] = await visibleSites().where(
            and(membershipWhere, eq(sites.id, siteId), isNull(sites.deletedAt))
          )
          if (!site) throw new Error("Site not found or access revoked")
          return result(
            await database
              .select({
                id: stories.id,
                title: stories.title,
                slug: stories.slug,
                type: stories.type,
                siteId: stories.siteId
              })
              .from(stories)
              .where(
                and(
                  eq(stories.siteId, site.id),
                  eq(stories.organisationId, site.workspaceId),
                  isNull(stories.deletedAt)
                )
              )
              .orderBy(stories.id)
              .offset(offset)
              .limit(limit)
          )
        }
      )
      return server
    },
    { legacy: "reject" }
  )
}
