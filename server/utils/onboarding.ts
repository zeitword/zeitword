import type { H3Event } from "h3"

import { sql } from "drizzle-orm"

import { authRateLimits } from "../database/schema"
import { db } from "./drizzle"

export async function limitOnboarding(event: H3Event) {
  const now = Date.now()
  const key = `onboarding:${getRequestIP(event) ?? "unknown"}`
  const [limit] = await db
    .insert(authRateLimits)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        count: sql`case when ${authRateLimits.lastRequest} < ${now - 3600_000} then 1 else ${authRateLimits.count} + 1 end`,
        lastRequest: sql`case when ${authRateLimits.lastRequest} < ${now - 3600_000} then ${now} else ${authRateLimits.lastRequest} end`
      }
    })
    .returning()
  if (!limit || limit.count > 15)
    throw createError({
      statusCode: 429,
      statusMessage: "Too many attempts. Please try again later."
    })
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if ("code" in error && error.code === "23505") return true
  return "cause" in error && isUniqueViolation(error.cause)
}
