import { eq } from "drizzle-orm"
import {
  siteLanguages,
  stories,
  sites,
  components,
  componentFields
} from "~~/server/database/schema"

type FieldType = {
  fieldKey: string
  type: string
}

// Fields that should be copied directly (not translated)
const nonTranslatableFields = [
  "asset",
  "assets",
  "boolean",
  "number",
  "datetime",
  "option",
  "options"
] as const

async function processBlockContent(
  tx: any,
  defaultContent: Record<string, any>,
  fields: FieldType[]
): Promise<Record<string, any>> {
  const newContent: Record<string, any> = {}

  for (const field of fields) {
    if (nonTranslatableFields.includes(field.type as any)) {
      newContent[field.fieldKey] = defaultContent[field.fieldKey]
    } else if (field.type === "blocks") {
      newContent[field.fieldKey] = await processBlocks(tx, defaultContent[field.fieldKey] || [])
    } else {
      newContent[field.fieldKey] = ""
    }
  }

  return newContent
}

async function processBlocks(tx: any, blocks: any[]): Promise<any[]> {
  const processedBlocks = []

  for (const block of blocks) {
    if (!block.componentId) {
      console.warn("Block without componentId found, skipping:", block)
      continue
    }

    const fields = await tx
      .select({
        fieldKey: componentFields.fieldKey,
        type: componentFields.type
      })
      .from(componentFields)
      .where(eq(componentFields.componentId, block.componentId))

    const newBlockContent = await processBlockContent(tx, block.content, fields)

    processedBlocks.push({
      ...block,
      content: newBlockContent
    })
  }

  return processedBlocks
}

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }

  const body = await readBody(event)
  if (!body.code) {
    throw createError({ statusCode: 400, statusMessage: "Language code is required" })
  }

  const db = useDrizzle()

  return await db.transaction(async (tx) => {
    // 1. Add the new language to siteLanguages
    const [newSiteLanguage] = await tx
      .insert(siteLanguages)
      .values({
        siteId,
        languageCode: body.code
      })
      .returning()

    // 2. Get site's default language
    const [site] = await tx
      .select({ defaultLanguage: sites.defaultLanguage })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1)

    if (!site) {
      throw createError({ statusCode: 404, statusMessage: "Site not found" })
    }

    // 3. Get all stories with their components
    const siteStories = await tx
      .select({
        id: stories.id,
        content: stories.content,
        componentId: stories.componentId
      })
      .from(stories)
      .where(eq(stories.siteId, siteId))

    // 4. Process each story
    for (const story of siteStories) {
      const currentContent = story.content as Record<string, any>
      const defaultLangContent = currentContent[site.defaultLanguage] || {}

      if (!story.componentId) {
        console.warn("Story without componentId found, skipping:", story.id)
        continue
      }

      // Get component fields
      const fields = await tx
        .select({
          fieldKey: componentFields.fieldKey,
          type: componentFields.type
        })
        .from(componentFields)
        .where(eq(componentFields.componentId, story.componentId))

      // Process content based on field types
      const newLangContent = await processBlockContent(tx, defaultLangContent, fields)

      // Update story with new language content
      await tx
        .update(stories)
        .set({
          content: {
            ...currentContent,
            [body.code]: newLangContent
          }
        })
        .where(eq(stories.id, story.id))
    }

    return newSiteLanguage
  })
})
