import { and, eq, inArray, notInArray } from "drizzle-orm"
import { LexoRank } from "lexorank"
import { uuidv7 } from "uuidv7"
import { z } from "zod"
import {
  assets,
  componentFields,
  components,
  fieldOptions,
  fieldTypeEnum,
  languages,
  siteLanguages,
  sites,
  stories,
  storyTranslatedSlugs
} from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Json = z.infer<typeof literalSchema> | { [key: string]: Json } | Json[]
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(z.string(), jsonSchema)])
)

const fieldSchema = z.object({
  name: z.string().min(1).max(255),
  fieldType: z.enum(fieldTypeEnum.enumValues),
  displayName: z.string().min(1).max(255),
  required: z.boolean().optional(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  componentWhitelist: z.array(z.string()).optional(),
  options: z.array(z.object({ optionName: z.string(), optionValue: z.string() })).optional()
})

const bodySchema = z.object({
  defaultLanguage: z.string().min(2).max(16),
  languages: z.array(z.string().min(2).max(16)).min(1),
  assetIds: z.array(z.string().uuid()),
  components: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        displayName: z.string().min(1).max(255),
        previewField: z.string().optional(),
        renderPreview: z.boolean().optional(),
        fields: z.array(fieldSchema)
      })
    )
    .min(1),
  stories: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(["story", "folder"]).default("story"),
      slug: z.string().min(1).max(255),
      title: z.string().min(1).max(255),
      componentName: z.string().optional(),
      content: z.record(z.string(), jsonSchema)
    })
  )
})

const paramsSchema = z.object({ siteId: z.string().uuid() })

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw createError({ statusCode: 400, statusMessage: `Duplicate ${label}` })
  }
}

export default defineEventHandler(async (event) => {
  const auth = await requireApiKey(event)
  const { siteId } = await getValidatedRouterParams(event, paramsSchema.parse)
  if (auth.siteId !== siteId) {
    throw createError({ statusCode: 403, statusMessage: "API key does not belong to this site" })
  }

  const data = await readValidatedBody(event, bodySchema.parse)
  const languageCodes = [...new Set(data.languages)]
  if (!languageCodes.includes(data.defaultLanguage)) {
    throw createError({ statusCode: 400, statusMessage: "Default language is not enabled" })
  }

  assertUnique(
    data.components.map((component) => component.name),
    "component names"
  )
  assertUnique(
    data.stories.map((story) => story.id),
    "story IDs"
  )
  assertUnique(
    data.stories.map((story) => story.slug),
    "story slugs"
  )
  assertUnique(data.assetIds, "asset IDs")

  const componentNames = new Set(data.components.map((component) => component.name))
  const storyIds = new Set(data.stories.map((story) => story.id))
  const importedAssetIds = new Set(data.assetIds)

  function validateContent(value: Json): void {
    if (Array.isArray(value)) {
      value.forEach(validateContent)
      return
    }
    if (!value || typeof value !== "object") return

    if ("componentName" in value && typeof value.componentName === "string") {
      if (!componentNames.has(value.componentName)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown component in content: ${value.componentName}`
        })
      }
    }
    if (value.type === "internal" && typeof value.storyId === "string") {
      if (!storyIds.has(value.storyId)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown internal story: ${value.storyId}`
        })
      }
    }
    if (
      ["image", "video", "audio", "pdf", "other"].includes(String(value.type)) &&
      typeof value.id === "string" &&
      !importedAssetIds.has(value.id)
    ) {
      throw createError({ statusCode: 400, statusMessage: `Unknown asset in content: ${value.id}` })
    }

    Object.values(value).forEach(validateContent)
  }

  for (const story of data.stories) {
    if (story.componentName && !componentNames.has(story.componentName)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown story component: ${story.componentName}`
      })
    }
    for (const language of Object.keys(story.content)) {
      if (!languageCodes.includes(language)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Story uses disabled language: ${language}`
        })
      }
    }
    validateContent(story.content)
  }

  const knownLanguages = await db
    .select({ code: languages.code })
    .from(languages)
    .where(inArray(languages.code, languageCodes))
  if (knownLanguages.length !== languageCodes.length) {
    throw createError({ statusCode: 400, statusMessage: "Import contains unknown language codes" })
  }

  if (data.assetIds.length > 0) {
    const importedAssets = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.siteId, siteId),
          eq(assets.organisationId, auth.organisationId),
          inArray(assets.id, data.assetIds)
        )
      )
    if (importedAssets.length !== data.assetIds.length) {
      throw createError({ statusCode: 400, statusMessage: "Import references missing assets" })
    }
  }

  const result = await db.transaction(async (tx) => {
    const oldAssetCondition =
      data.assetIds.length > 0
        ? and(
            eq(assets.siteId, siteId),
            eq(assets.organisationId, auth.organisationId),
            notInArray(assets.id, data.assetIds)
          )
        : and(eq(assets.siteId, siteId), eq(assets.organisationId, auth.organisationId))
    const oldAssets = await tx.select({ id: assets.id }).from(assets).where(oldAssetCondition)

    await tx.delete(storyTranslatedSlugs).where(eq(storyTranslatedSlugs.siteId, siteId))
    await tx.delete(stories).where(eq(stories.siteId, siteId))
    await tx.delete(fieldOptions).where(eq(fieldOptions.siteId, siteId))
    await tx.delete(componentFields).where(eq(componentFields.siteId, siteId))
    await tx.delete(components).where(eq(components.siteId, siteId))
    await tx.delete(assets).where(oldAssetCondition)
    await tx.delete(siteLanguages).where(eq(siteLanguages.siteId, siteId))
    await tx.insert(siteLanguages).values(
      languageCodes.map((languageCode) => ({
        siteId,
        languageCode
      }))
    )
    await tx
      .update(sites)
      .set({ defaultLanguage: data.defaultLanguage, updatedAt: new Date() })
      .where(and(eq(sites.id, siteId), eq(sites.organisationId, auth.organisationId)))

    const componentIds = new Map<string, string>()
    let fieldsImported = 0
    let optionsImported = 0

    for (const component of data.components) {
      const id = uuidv7()
      componentIds.set(component.name, id)
      await tx.insert(components).values({
        id,
        name: component.name,
        displayName: component.displayName,
        previewField: component.previewField,
        renderPreview: component.renderPreview ?? false,
        siteId,
        organisationId: auth.organisationId
      })

      let order = LexoRank.min().genNext()
      for (const field of component.fields) {
        await tx.insert(componentFields).values({
          componentId: id,
          fieldKey: field.name,
          order: order.toString(),
          type: field.fieldType,
          required: field.required ?? false,
          description: field.description,
          displayName: field.displayName,
          defaultValue: field.defaultValue,
          componentWhitelist: field.componentWhitelist ?? [],
          siteId,
          organisationId: auth.organisationId
        })
        fieldsImported++
        order = order.genNext()

        if (field.options?.length) {
          await tx.insert(fieldOptions).values(
            field.options.map((option) => ({
              componentId: id,
              fieldKey: field.name,
              optionName: option.optionName,
              optionValue: option.optionValue,
              siteId,
              organisationId: auth.organisationId
            }))
          )
          optionsImported += field.options.length
        }
      }
    }

    function addComponentIds(value: Json): Json {
      if (Array.isArray(value)) return value.map(addComponentIds)
      if (!value || typeof value !== "object") return value

      const transformed: Record<string, Json> = {}
      for (const [key, child] of Object.entries(value)) {
        transformed[key] = addComponentIds(child)
      }
      if (typeof value.componentName === "string") {
        transformed.componentId = componentIds.get(value.componentName)!
      }
      return transformed
    }

    for (const story of data.stories) {
      await tx.insert(stories).values({
        id: story.id,
        type: story.type,
        slug: story.slug,
        title: story.title,
        content: addComponentIds(story.content),
        componentId: story.componentName ? componentIds.get(story.componentName) : null,
        siteId,
        organisationId: auth.organisationId
      })
    }

    return {
      oldAssetIds: oldAssets.map((asset) => asset.id),
      components: data.components.length,
      fields: fieldsImported,
      options: optionsImported,
      stories: data.stories.length,
      assets: data.assetIds.length
    }
  })

  const s3 = useS3()
  await Promise.allSettled(result.oldAssetIds.map((assetId) => s3.deleteItem(assetId)))

  return {
    components: result.components,
    fields: result.fields,
    options: result.options,
    stories: result.stories,
    assets: result.assets
  }
})
