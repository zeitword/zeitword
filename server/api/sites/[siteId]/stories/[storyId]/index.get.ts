import {
  stories,
  components,
  componentFields,
  fieldOptions,
  storyTypeEnum
} from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  const storyId = getRouterParam(event, "storyId")

  if (!siteId || !storyId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Site or Item ID" })
  }

  const [itemData] = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content,
      type: stories.type,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt,
      componentId: stories.componentId,
      component: {
        id: components.id,
        name: components.name,
        displayName: components.displayName,
        previewImage: components.previewImage,
        previewField: components.previewField,
        renderPreview: components.renderPreview
      }
    })
    .from(stories)
    .leftJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, secure.organisationId)
      )
    )
    .limit(1)

  if (!itemData) {
    throw createError({ statusCode: 404, statusMessage: "Item not found" })
  }

  // 2. If it's a STORY, fetch fields and options
  if (itemData.type === storyTypeEnum.enumValues[0] && itemData.component?.id) {
    const componentId = itemData.component.id

    const fields = await useDrizzle()
      .select()
      .from(componentFields)
      .where(
        and(
          eq(componentFields.componentId, componentId),
          eq(componentFields.organisationId, secure.organisationId)
        )
      )
      .orderBy(componentFields.order)

    const options = await useDrizzle()
      .select()
      .from(fieldOptions)
      .where(
        and(
          eq(fieldOptions.componentId, componentId),
          eq(fieldOptions.organisationId, secure.organisationId)
        )
      )

    const optionsMap = new Map<string, { optionName: string; optionValue: string }[]>()
    options.forEach((option) => {
      const key = `${option.componentId}-${option.fieldKey}`
      if (!optionsMap.has(key)) {
        optionsMap.set(key, [])
      }
      optionsMap.get(key)!.push({ optionName: option.optionName, optionValue: option.optionValue })
    })

    const fieldsWithOptions = fields.map((field) => {
      if (field.type === "option" || field.type === "options") {
        const key = `${componentId}-${field.fieldKey}`
        return {
          ...field,
          options: optionsMap.get(key) || []
        }
      }
      return field
    })

    return {
      id: itemData.id,
      slug: itemData.slug,
      title: itemData.title,
      componentId: itemData.componentId,
      content: itemData.content,
      type: itemData.type,
      createdAt: itemData.createdAt,
      updatedAt: itemData.updatedAt,
      component: {
        ...itemData.component,
        fields: fieldsWithOptions
      }
    }
  } else {
    return {
      id: itemData.id,
      slug: itemData.slug,
      title: itemData.title,
      content: itemData.content,
      type: itemData.type,
      createdAt: itemData.createdAt,
      updatedAt: itemData.updatedAt,
      component: null
    }
  }
})
