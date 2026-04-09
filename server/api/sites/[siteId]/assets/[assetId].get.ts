import { eq, and, isNull } from "drizzle-orm"
import { assets } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const assetId = getRouterParam(event, "assetId")
  if (!assetId) throw createError({ statusCode: 400, statusMessage: "Invalid Asset ID" })

  const [asset] = await useDrizzle()
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.siteId, siteId),
        eq(assets.organisationId, secure.organisationId),
        isNull(assets.deletedAt)
      )
    )

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: "Asset not found" })
  }

  return asset
})
