import { components, componentFields } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId)
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const componentsData = await useDrizzle()
    .select()
    .from(components)
    .where(
      and(
        eq(components.siteId, siteId),
        eq(components.organisationId, secure.organisationId)
      )
    )
    .leftJoin(componentFields, eq(components.id, componentFields.componentId))

  const componentMap = new Map()

  componentsData.forEach((row) => {
    if (!componentMap.has(row.components.id)) {
      componentMap.set(row.components.id, {
        ...row.components,
        fields: []
      })
    }
    if (row.component_fields) {
      componentMap.get(row.components.id).fields.push(row.component_fields)
    }
  })

  return Array.from(componentMap.values())
})
