import { z } from "zod"
import { components } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255)
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [component] = await useDrizzle()
    .insert(components)
    .values({
      name: data.name,
      displayName: data.displayName,
      siteId: siteId,
      organisationId: organisationId
    })
    .returning()

  return component
})
