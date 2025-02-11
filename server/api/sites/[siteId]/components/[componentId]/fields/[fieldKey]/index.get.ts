import { componentFields, components } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "No componentId provided" })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey) throw createError({ statusCode: 400, statusMessage: "No fieldKey provided" })

  const [field] = await useDrizzle()
    .select()
    .from(componentFields)
    .where(
      and(
        eq(componentFields.componentId, componentId),
        eq(componentFields.fieldKey, fieldKey),
        eq(componentFields.organisationId, secure.organisationId)
      )
    )
  return field
})
