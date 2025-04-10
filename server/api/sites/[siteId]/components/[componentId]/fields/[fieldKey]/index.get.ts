import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"
import { validateRouteParams, commonSchemas } from "~~/server/utils/validation"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Validate route parameters using Zod
  const { siteId, componentId, fieldKey } = validateRouteParams(event, {
    siteId: commonSchemas.siteId,
    componentId: commonSchemas.componentId,
    fieldKey: commonSchemas.fieldKey
  })

  const db = useDrizzle()

  const [field] = await db
    .select()
    .from(componentFields)
    .where(
      and(
        eq(componentFields.componentId, componentId),
        eq(componentFields.fieldKey, fieldKey),
        eq(componentFields.organisationId, secure.organisationId)
      )
    )
  if (!field) {
    throw createError({ statusCode: 404, statusMessage: "Field not found" })
  }

  if (field.type === "option" || field.type === "options") {
    const options = await db
      .select()
      .from(fieldOptions)
      .where(
        and(
          eq(fieldOptions.componentId, componentId),
          eq(fieldOptions.fieldKey, fieldKey),
          eq(fieldOptions.organisationId, secure.organisationId)
        )
      )
    return { ...field, options }
  }

  return field
})
