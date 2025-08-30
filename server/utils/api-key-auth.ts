import { siteApiKeys, siteLanguages, sites } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"
import type { H3Event } from "h3"

export interface ApiKeyAuthResult {
  siteId: string
  organisationId: string
  site: {
    id: string
    name: string
    domain: string
    defaultLanguage: string
    availableLanguages: string[]
  }
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyAuthResult> {
  // API key format: zeitword_{id}_{secret}
  const parts = apiKey.split("_")
  if (parts.length !== 3 || parts[0] !== "zeitword") {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid API key format"
    })
  }

  const [id, secret] = parts.slice(1)

  // Find the API key in the database
  try {
    const [apiKeyRecord] = await useDrizzle()
      .select({
        id: siteApiKeys.id,
        hash: siteApiKeys.hash,
        siteId: siteApiKeys.siteId,
        organisationId: siteApiKeys.organisationId
      })
      .from(siteApiKeys)
      .where(eq(siteApiKeys.id, id))
      .limit(1)

    if (!apiKeyRecord) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid API key"
      })
    }

    // Verify the secret
    const isValid = await verifyPassword(apiKeyRecord.hash, secret)
    if (!isValid) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid API key"
      })
    }

    // Get site information
    const [site] = await useDrizzle()
      .select({
        id: sites.id,
        name: sites.name,
        domain: sites.domain,
        defaultLanguage: sites.defaultLanguage
      })
      .from(sites)
      .where(
        and(
          eq(sites.id, apiKeyRecord.siteId),
          eq(sites.organisationId, apiKeyRecord.organisationId)
        )
      )
      .limit(1)

    if (!site) {
      throw createError({
        statusCode: 404,
        statusMessage: "Site not found"
      })
    }

    const languages = await useDrizzle()
      .select()
      .from(siteLanguages)
      .where(eq(siteLanguages.siteId, site.id))

    return {
      siteId: apiKeyRecord.siteId,
      organisationId: apiKeyRecord.organisationId,
      site: {
        ...site,
        availableLanguages: languages.map((l) => l.languageCode)
      }
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid API key"
    })
  }
}

export function requireApiKey(event: H3Event): Promise<ApiKeyAuthResult> {
  const authHeader = getHeader(event, "authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing or invalid Authorization header"
    })
  }

  const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix
  return validateApiKey(apiKey)
}
