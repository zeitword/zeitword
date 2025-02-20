import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId)
    throw createError({
      statusCode: 400,
      statusMessage: "No componentId provided"
    })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey)
    throw createError({
      statusCode: 400,
      statusMessage: "No fieldKey provided"
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
