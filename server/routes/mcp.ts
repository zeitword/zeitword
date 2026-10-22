import { requireMcpAuth } from "@better-auth/mcp"
import { createInsufficientScopeError } from "better-auth/oauth2"

import { createAccountMcp, mcpIdentity } from "../mcp"
import { contentWriteTools } from "../mcp/tools"
import { db } from "../utils/drizzle"

export default defineEventHandler(async (event) => {
  if (event.method !== "POST") {
    setHeader(event, "Allow", "POST")
    throw createError({ statusCode: 405, statusMessage: "Method not allowed" })
  }
  const resource = `${useRuntimeConfig().public.appUrl.replace(/\/$/, "")}/mcp`
  return requireMcpAuth(
    useAuth(),
    async (request, claims) => {
      const body = await request
        .clone()
        .json()
        .catch(() => null)
      const write = body?.method === "tools/call" && contentWriteTools.has(body?.params?.name)
      const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : []
      if (write && !scopes.includes("mcp:write")) throw createInsufficientScopeError(["mcp:write"])
      const user = await mcpIdentity(db, claims, write ? ["mcp:read", "mcp:write"] : ["mcp:read"])
      if (!user)
        return new Response(
          JSON.stringify({ error: "Account or authorization is no longer available" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${new URL(resource).origin}/.well-known/oauth-protected-resource/mcp"`
            }
          }
        )
      return createAccountMcp(db, user, {
        baseURL: useRuntimeConfig().public.appUrl.replace(/\/$/, ""),
        canWrite: write
      }).fetch(request)
    },
    { resource, requiredScopes: ["mcp:read"] }
  )(toWebRequest(event))
})
