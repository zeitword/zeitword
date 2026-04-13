import { eq, and, inArray } from "drizzle-orm"
import { components, componentFields, fieldOptions } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const componentsData = await useDrizzle()
    .select()
    .from(components)
    .where(and(eq(components.siteId, siteId), eq(components.organisationId, organisationId)))
    .leftJoin(componentFields, eq(components.id, componentFields.componentId))

  const componentMap = new Map()
  const componentIds: string[] = []

  componentsData.forEach((row) => {
    if (!componentMap.has(row.components.id)) {
      componentMap.set(row.components.id, {
        ...row.components,
        fields: []
      })
      componentIds.push(row.components.id)
    }
    if (row.component_fields) {
      componentMap.get(row.components.id).fields.push(row.component_fields)
    }
  })

  let optionsMap = new Map<string, { optionName: string; optionValue: string }[]>()
  if (componentIds.length > 0) {
    const relevantOptions = await useDrizzle()
      .select()
      .from(fieldOptions)
      .where(
        and(
          inArray(fieldOptions.componentId, componentIds), // Filter by component IDs
          eq(fieldOptions.organisationId, organisationId)
        )
      )

    relevantOptions.forEach((option) => {
      const key = `${option.componentId}-${option.fieldKey}`
      if (!optionsMap.has(key)) {
        optionsMap.set(key, [])
      }
      optionsMap.get(key)!.push({ optionName: option.optionName, optionValue: option.optionValue })
    })
  }

  // Add options to fields
  const componentsWithFieldsAndOptions = Array.from(componentMap.values()).map((component) => {
    const fieldsWithOptions = component.fields.map((field: typeof componentFields.$inferSelect) => {
      if (field.type === "option" || field.type === "options") {
        const key = `${component.id}-${field.fieldKey}`
        return {
          ...field,
          options: optionsMap.get(key) || []
        }
      }
      return field
    })

    return {
      ...component,
      fields: fieldsWithOptions
    }
  })

  return componentsWithFieldsAndOptions
})
