import { z } from "zod"
import { components } from "~~/server/database/schema"
import { validateField, validateRouteParams, commonSchemas } from "~~/server/utils/validation"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Validate route parameters using Zod
  const { siteId } = validateRouteParams(event, {
    siteId: commonSchemas.siteId
  })

  // Validate request body
  const data = await validateField(event, bodySchema)

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
