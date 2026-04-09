import { eq, and, isNull, ilike, desc, count, type SQL } from "drizzle-orm"
import { z } from "zod"
import { assets } from "~~/server/database/schema"
import { withPaginationDecorator } from "~~/server/utils/pagination"

const querySchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  offset: z.coerce.number().min(0).optional().default(0),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const { search, type, offset, limit } = await getValidatedQuery(event, querySchema.parse)

  const conditions: (SQL | undefined)[] = [
    eq(assets.siteId, siteId),
    eq(assets.organisationId, secure.organisationId),
    isNull(assets.deletedAt)
  ]

  if (search) {
    conditions.push(ilike(assets.fileName, `%${search}%`))
  }

  if (type) {
    conditions.push(eq(assets.type, type))
  }

  const whereCondition = and(...conditions)

  // Get total count for pagination
  const [countResult] = await useDrizzle()
    .select({ count: count() })
    .from(assets)
    .where(whereCondition)
  const totalAssets = countResult?.count ?? 0

  // Get paginated data
  const data = await useDrizzle()
    .select()
    .from(assets)
    .where(whereCondition)
    .orderBy(desc(assets.createdAt))
    .limit(limit)
    .offset(offset)

  return withPaginationDecorator(data, totalAssets, offset, limit)
})
