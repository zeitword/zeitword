import { createOpenAI } from "@ai-sdk/openai"
import { generateObject, NoObjectGeneratedError } from "ai"
import z from "zod"
import { and, eq } from "drizzle-orm"
import { stories, componentFields } from "~~/server/database/schema"
import { merge, set } from "lodash-es"
import { trackUsage } from "./chat"

const openai = createOpenAI({
  apiKey: useRuntimeConfig().openaiApiKey
})

const bodySchema = z.object({
  storyId: z.string().uuid(),
  fromLanguage: z.string().min(2).max(2),
  toLanguage: z.string().min(2).max(2)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const enoughFunds = await hasSufficientFunds({ organisationId: secure.organisationId })
  if (!enoughFunds) throw createError({ statusCode: 402, statusMessage: "Insufficient funds" })

  const { storyId, fromLanguage, toLanguage } = await readValidatedBody(event, bodySchema.parse)

  const [story] = await useDrizzle()
    .select()
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.organisationId, secure.organisationId)))
    .limit(1)
  if (!story) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  if (!story.componentId)
    throw createError({ statusCode: 404, statusMessage: "Component not found" })

  const content = story.content as Record<string, any>

  const translateableFields = await getTranslatableContentFields(
    story.componentId,
    secure.organisationId,
    story.siteId,
    content[fromLanguage],
    []
  )

  const { object: translatedStory, usage } = await translateStory({
    content: JSON.stringify(translateableFields),
    fromLanguage,
    toLanguage
  })

  await trackUsage({
    usage: usage,
    userId: secure.userId,
    modelId: "gpt-4o",
    organisationId: secure.organisationId
  })

  if (!translatedStory)
    throw createError({ statusCode: 500, statusMessage: "Failed to translate story" })

  // Use fromLanguage as base to merge the translated fields into
  let result = JSON.parse(JSON.stringify(content[fromLanguage]))
  for (const field of translatedStory.fields) {
    let insert = set({}, field.path.join("."), field.value)
    merge(result, insert)
  }

  // Overwrite the fromLanguage with the translated fields
  content[toLanguage] = result

  return {
    ...content
  }
})

async function getTranslatableContentFields(
  componentId: string,
  organisationId: string,
  siteId: string,
  content: Record<string, any>,
  path: string[] = []
): Promise<{ value: string; path: string[] }[]> {
  const allComponentFields = await useDrizzle()
    .select()
    .from(componentFields)
    .where(
      and(
        eq(componentFields.componentId, componentId),
        eq(componentFields.organisationId, organisationId)
      )
    )

  const stringFields = ["text", "textarea", "richtext"]
  const translateableFields = []

  const fields = Object.entries(content)
  for (const [fieldKey, value] of fields) {
    if (!value) continue

    const fieldType = allComponentFields.find((field) => field.fieldKey === fieldKey)?.type
    if (stringFields.includes(fieldType || "")) {
      translateableFields.push({ value, path: [...path, fieldKey] })
    }

    if (fieldType === "blocks") {
      for (const [index, block] of value.entries()) {
        translateableFields.push(
          ...(await getTranslatableContentFields(
            block.componentId,
            organisationId,
            siteId,
            block.content,
            [...path, fieldKey, index, "content"]
          ))
        )
      }
    }

    if (fieldType === "assets") {
      for (const [index, asset] of value.entries()) {
        translateableFields.push({
          value: asset.alt,
          path: [...path, fieldKey, index, "alt"]
        })
      }
    }

    if (fieldType === "asset") {
      translateableFields.push({ value: value.alt, path: [...path, fieldKey, "alt"] })
    }
  }

  return translateableFields
}

async function translateStory({
  content,
  fromLanguage,
  toLanguage
}: {
  content: string
  fromLanguage: string
  toLanguage: string
}) {
  try {
    return await generateObject({
      model: openai.responses("gpt-4o"),
      schema: z.object({
        fields: z.array(
          z.object({
            path: z.array(z.union([z.string(), z.number()])),
            value: z.string()
          })
        )
      }),
      prompt: `Translate the following fields from ${fromLanguage} to ${toLanguage}. 
      Only translate the value property, preserve the path property.
      
      fields: ${content}`
    })
  } catch (error) {
    console.error(error)

    if (NoObjectGeneratedError.isInstance(error)) {
      return { object: undefined, usage: error.usage }
    }

    throw error
  }
}
