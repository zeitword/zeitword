import { personalAccessTokens, users } from "~~/server/database/schema"
import { eq, and, isNull, or, gt } from "drizzle-orm"
import type { H3Event } from "h3"

export interface PatAuthResult {
  userId: string
  organisationId: string
  user: {
    id: string
    name: string
    email: string
  }
}

// Reuse the same dummy hash from api-key-auth for timing-attack mitigation
const DUMMY_HASH =
  "$scrypt$n=16384,r=8,p=1$16qaJvWM3W48DZjU94Xx0Q$18+E1xYZTkBnJ4wl4IIHo+M+DiyNy0T7C90LhUdiVkfdqb1Hep/m493OGjLDrQflzS4+oVl5LVZaYZ5lpzSwIA"

export async function validatePat(token: string): Promise<PatAuthResult> {
  // PAT format: zwpat_{id}_{secret}
  const parts = token.split("_")
  if (parts.length !== 3 || parts[0] !== "zwpat") {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid token format"
    })
  }

  const [id, secret] = parts.slice(1)

  try {
    const [tokenRecord] = await useDrizzle()
      .select({
        id: personalAccessTokens.id,
        hash: personalAccessTokens.hash,
        userId: personalAccessTokens.userId,
        organisationId: personalAccessTokens.organisationId,
        expiresAt: personalAccessTokens.expiresAt
      })
      .from(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.id, id),
          isNull(personalAccessTokens.deletedAt)
        )
      )
      .limit(1)

    // Verify the secret (always run verifyPassword to prevent timing attacks)
    const isValid = await verifyPassword(tokenRecord?.hash ?? DUMMY_HASH, secret)
    if (!isValid || !tokenRecord) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid token"
      })
    }

    // Check expiration
    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      throw createError({
        statusCode: 401,
        statusMessage: "Token has expired"
      })
    }

    // Get user information
    const [user] = await useDrizzle()
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(
        and(
          eq(users.id, tokenRecord.userId),
          isNull(users.deletedAt)
        )
      )
      .limit(1)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "User not found"
      })
    }

    // Update lastUsedAt (fire and forget — don't block the request)
    useDrizzle()
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(personalAccessTokens.id, tokenRecord.id))
      .execute()
      .catch(() => {})

    return {
      userId: tokenRecord.userId,
      organisationId: tokenRecord.organisationId,
      user
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid token"
    })
  }
}

/**
 * Extract and validate a PAT from the Authorization header.
 * Falls through to session auth if no Bearer token is present.
 */
export function requirePat(event: H3Event): Promise<PatAuthResult> {
  const authHeader = getHeader(event, "authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing or invalid Authorization header"
    })
  }

  const token = authHeader.substring(7)
  return validatePat(token)
}

/**
 * Try PAT auth first, fall back to session auth.
 * Returns a normalized auth result that works for both cases.
 */
export async function requireAuth(event: H3Event): Promise<{
  userId: string
  organisationId: string
}> {
  const authHeader = getHeader(event, "authorization")

  // If Bearer token is present, try PAT auth
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7)

    // Check if it's a PAT (zwpat_) or a site API key (zeitword_)
    if (token.startsWith("zwpat_")) {
      const result = await validatePat(token)
      return {
        userId: result.userId,
        organisationId: result.organisationId
      }
    }
  }

  // Fall back to session auth
  const { secure } = await requireUserSession(event)
  if (!secure) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  return {
    userId: secure.userId,
    organisationId: secure.organisationId
  }
}
