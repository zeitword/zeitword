// zeitword/server/api/sites/[siteId]/components/[componentId]/fields/[fieldKey]/index.patch.ts
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { componentFields } from "~~/server/database/schema"
import { useDrizzle } from "~~/server/utils/drizzle" // Import useDrizzle
import { validateField, validateRouteParams, commonSchemas } from "~~/server/utils/validation"

const bodySchema = z.object({
  order: z.string()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Validate route parameters using Zod
  const { siteId, componentId, fieldKey } = validateRouteParams(event, {
    siteId: commonSchemas.siteId,
    componentId: commonSchemas.componentId,
    fieldKey: commonSchemas.fieldKey
  })

  // Validate request body
  const data = await validateField(event, bodySchema)

  const [updatedField] = await useDrizzle()
    .update(componentFields)
    .set({ order: data.order })
    .where(
      and(
        eq(componentFields.organisationId, secure.organisationId),
        eq(componentFields.componentId, componentId),
        eq(componentFields.fieldKey, fieldKey),
        eq(componentFields.siteId, siteId)
      )
    )
    .returning()

  if (!updatedField)
    throw createError({ statusCode: 404, statusMessage: "Component Field Not Found" })

  return updatedField
})
