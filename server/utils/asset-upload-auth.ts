import type { H3Event } from "h3"

export async function requireAssetUploadAuth(event: H3Event): Promise<{
  userId: string | null
  organisationId: string
  siteId: string | null
}> {
  const authorization = getHeader(event, "authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null

  if (token?.startsWith("zeitword_")) {
    const auth = await validateApiKey(token)
    return {
      userId: null,
      organisationId: auth.organisationId,
      siteId: auth.siteId
    }
  }

  const auth = await requireAuth(event)
  return {
    userId: auth.userId,
    organisationId: auth.organisationId,
    siteId: null
  }
}
