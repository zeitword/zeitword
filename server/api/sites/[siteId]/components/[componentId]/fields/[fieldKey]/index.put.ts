import { z } from "zod"
import { componentFields } from "~~/server/database/schema"

const bodySchema = z.object({
  fieldKey: z.string().min(1).max(255),
  fieldType: z.enum([
    "blocks",
    "text",
    "textarea",
    "richtext",
    "markdown",
    "number",
    "datetime",
    "boolean",
    "option",
    "options",
    "asset",
    "assets",
    "link",
    "section",
    "custom"
  ]),
  required: z.boolean(),
  description: z.string().max(255).nullable(),
  displayName: z.string().max(255).nullable(),
  defaultValue: z.string().max(255).nullable(),
  minValue: z.number().min(0).nullable(),
  maxValue: z.number().min(0).nullable()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey) throw createError({ statusCode: 400, statusMessage: "Invalid Field Key" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [componentField] = await useDrizzle()
    .update(componentFields)
    .set({
      fieldKey: data.fieldKey,
      type: data.fieldType,
      required: data.required,
      description: data.description,
      displayName: data.displayName,
      defaultValue: data.defaultValue,
      minValue: data.minValue,
      maxValue: data.maxValue
    })
    .where(
      and(
        eq(componentFields.organisationId, secure.organisationId),
        eq(componentFields.componentId, componentId),
        eq(componentFields.fieldKey, fieldKey)
      )
    )
    .returning()

  return componentField
})
