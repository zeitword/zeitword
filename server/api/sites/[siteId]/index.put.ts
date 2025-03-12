import { z } from "zod"
import { sites } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().min(0).max(255).optional()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle()
    .update(sites)
    .set({
      name: data.name,
      domain: data.domain
    })
    .where(and(eq(sites.id, siteId), eq(sites.organisationId, secure.organisationId)))
    .returning()
  return site
})
