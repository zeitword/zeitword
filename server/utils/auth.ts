import type { H3Event } from "h3"

import { AsyncLocalStorage } from "node:async_hooks"

import { createAuth, type AuthDatabase } from "../auth"
import { db } from "./drizzle"

let auth: ReturnType<typeof createAuth> | undefined
const authEvents = new AsyncLocalStorage<H3Event>()

export function handleAuthRequest(event: H3Event) {
  return authEvents.run(event, async () => {
    const path = getRequestURL(event).pathname.slice("/api/auth".length)
    const publicPaths = [
      "/sign-in/email",
      "/sign-up/email",
      "/get-session",
      "/sign-out",
      "/request-password-reset",
      "/reset-password",
      "/error"
    ]
    if (!publicPaths.includes(path) && !path.startsWith("/reset-password/")) {
      // Apply Zeitword's current-account checks to Better Auth's session-based
      // account-management endpoints, not only to CMS endpoints.
      await requireAppSession(event)
    }
    return useAuth().handler(authRequest(event))
  })
}

export function authHeaders(event: H3Event) {
  const headers = new Headers(getRequestHeaders(event) as Record<string, string>)
  headers.delete("x-zeitword-client-ip")
  const peer = getRequestIP(event)
  const trustedProxies = useRuntimeConfig()
    .authTrustedProxyIps.split(",")
    .map((ip: string) => ip.trim())
    .filter(Boolean)
  const ip =
    peer && trustedProxies.includes(peer) ? getRequestIP(event, { xForwardedFor: true }) : peer
  if (ip) headers.set("x-zeitword-client-ip", ip)
  return headers
}

export function authRequest(event: H3Event) {
  return new Request(toWebRequest(event), { headers: authHeaders(event) })
}

export function useAuth(database?: AuthDatabase) {
  if (!database && auth) return auth
  const config = useRuntimeConfig()
  if (!config.authSecret || config.authSecret.length < 32) {
    throw new Error("NUXT_AUTH_SECRET must contain at least 32 characters")
  }
  const instance = createAuth(database ?? db, {
    secret: config.authSecret,
    baseURL: config.public.appUrl,
    resend: config.resend,
    backgroundTask: (task) => {
      const handled = task.catch((error) =>
        console.error("Authentication background task failed", error)
      )
      const event = authEvents.getStore()
      if (event) event.waitUntil(handled)
    }
  })
  if (!database) auth = instance
  return instance
}

export async function requireAppSession(event: H3Event) {
  if (!["GET", "HEAD", "OPTIONS"].includes(event.method)) {
    const origin = getHeader(event, "origin")
    if (
      (origin && origin !== new URL(useRuntimeConfig().public.appUrl).origin) ||
      getHeader(event, "sec-fetch-site") === "cross-site"
    ) {
      throw createError({ statusCode: 403, statusMessage: "Invalid origin" })
    }
  }
  const result = await useAuth().api.getSession({ headers: authHeaders(event) })
  if (!result) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  return {
    user: result.user,
    session: result.session,
    secure: { userId: result.user.id, organisationId: result.user.organisationId }
  }
}

// The custom onboarding routes are outside the Better Auth handler, so enforce
// same-origin JSON requests before accepting credentials or issuing cookies.
export function requireAuthOrigin(event: H3Event) {
  const origin = getHeader(event, "origin")
  const expected = new URL(useRuntimeConfig().public.appUrl).origin
  if ((origin && origin !== expected) || getHeader(event, "sec-fetch-site") === "cross-site") {
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" })
  }
  if (getHeader(event, "content-type")?.split(";")[0]?.trim() !== "application/json") {
    throw createError({ statusCode: 415, statusMessage: "Expected application/json" })
  }
}
