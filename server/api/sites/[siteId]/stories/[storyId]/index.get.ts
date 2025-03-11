import { stories, components, componentFields, fieldOptions } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  // First get the story and its component
  const [storyData] = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content,
      component: {
        id: components.id,
        name: components.name,
        displayName: components.displayName,
        previewImage: components.previewImage,
        previewField: components.previewField
      }
    })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(components.siteId, siteId),
        eq(stories.organisationId, secure.organisationId),
        eq(stories.id, storyId)
      )
    )

  if (!storyData) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  const fields = await useDrizzle()
    .select()
    .from(componentFields)
    .where(
      and(
        eq(componentFields.componentId, storyData.component.id),
        eq(componentFields.organisationId, secure.organisationId)
      )
    )

  // Fetch options for fields of type 'option' or 'options'
  const componentId = storyData.component.id
  const options = await useDrizzle()
    .select()
    .from(fieldOptions)
    .where(
      and(
        eq(fieldOptions.componentId, componentId),
        eq(fieldOptions.organisationId, secure.organisationId)
      )
    )

  // Create a map for quick option lookup
  const optionsMap = new Map<string, { optionName: string; optionValue: string }[]>()
  options.forEach((option) => {
    const key = `${option.componentId}-${option.fieldKey}`
    if (!optionsMap.has(key)) {
      optionsMap.set(key, [])
    }
    optionsMap.get(key)!.push({ optionName: option.optionName, optionValue: option.optionValue })
  })

  // Add options to the relevant fields
  const fieldsWithOptions = fields.map((field) => {
    if (field.type === "option" || field.type === "options") {
      const key = `${componentId}-${field.fieldKey}`
      return {
        ...field,
        options: optionsMap.get(key) || [] // Return options if found, otherwise an empty array
      }
    }
    return field
  })

  return {
    ...storyData,
    component: {
      ...storyData.component,
      fields: fieldsWithOptions // Use the fields with options
    }
  }
})
