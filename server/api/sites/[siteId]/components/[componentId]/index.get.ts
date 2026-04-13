import { componentFields, components } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Component ID"
    })

  const componentsData = await useDrizzle()
    .select()
    .from(components)
    .where(
      and(
        eq(components.id, componentId),
        eq(components.siteId, siteId),
        eq(components.organisationId, organisationId)
      )
    )
    .leftJoin(componentFields, eq(components.id, componentFields.componentId))

  const component = componentsData[0].components

  const fields = componentsData.map((row) => row.component_fields).filter((field) => field !== null)

  return {
    ...component,
    fields
  }
})
