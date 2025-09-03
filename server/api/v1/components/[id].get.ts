import { requireApiKey } from "~~/server/utils/api-key-auth"
import { components } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const paramSchema = z.object({
  id: z.uuid()
})

export default defineEventHandler(async (event) => {
  const auth = await requireApiKey(event)

  const { id: componentId } = await getValidatedRouterParams(event, paramSchema.parse)
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const [component] = await useDrizzle()
    .select()
    .from(components)
    .where(
      and(
        eq(components.id, componentId),
        eq(components.organisationId, auth.organisationId),
        eq(components.siteId, auth.siteId)
      )
    )
    .limit(1)

  if (!component) {
    throw createError({
      statusCode: 404,
      statusMessage: "Component not found"
    })
  }

  return component
})
