// zeitword/server/api/sites/[siteId]/components/[componentId]/fields/[fieldKey]/index.patch.ts
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { componentFields } from "~~/server/database/schema"
import { useDrizzle } from "~~/server/utils/drizzle" // Import useDrizzle

const bodySchema = z.object({
  order: z.string()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey) throw createError({ statusCode: 400, statusMessage: "Invalid Field Key" })

  const data = await readValidatedBody(event, bodySchema.parse)

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
