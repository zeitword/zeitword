import { z } from "zod"
import { components } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [component] = await useDrizzle()
    .insert(components)
    .values({
      name: data.name,
      displayName: data.displayName,
      siteId: siteId,
      organisationId: secure.organisationId
    })
    .returning()

  return component
})
