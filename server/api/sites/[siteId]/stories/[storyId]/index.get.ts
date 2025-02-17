import { stories, components, componentFields } from "~~/server/database/schema"
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
      and(eq(components.siteId, siteId), eq(stories.organisationId, secure.organisationId), eq(stories.id, storyId))
    )

  if (!storyData) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  const fields = await useDrizzle()
    .select({
      fieldKey: componentFields.fieldKey,
      type: componentFields.type,
      required: componentFields.required,
      description: componentFields.description,
      displayName: componentFields.displayName,
      defaultValue: componentFields.defaultValue,
      minValue: componentFields.minValue,
      maxValue: componentFields.maxValue
    })
    .from(componentFields)
    .where(
      and(
        eq(componentFields.componentId, storyData.component.id),
        eq(componentFields.organisationId, secure.organisationId)
      )
    )

  return {
    ...storyData,
    component: {
      ...storyData.component,
      fields
    }
  }
})
