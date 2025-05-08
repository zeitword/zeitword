import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Literal = z.infer<typeof literalSchema>
type Json = Literal | { [key: string]: Json } | Json[]

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
)

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  optionName: z.string().min(1),
  optionValue: z.string().min(1)
})

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
  maxValue: z.number().min(0).nullable(),
  componentWhitelist: z.array(z.string()).optional(),
  options: z.array(optionSchema).optional(),
  config: jsonSchema.optional()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Site ID"
    })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Component ID"
    })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey) throw createError({ statusCode: 400, statusMessage: "Invalid Field Key" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  const tx = await db.transaction(async (tx) => {
    const [componentField] = await tx
      .update(componentFields)
      .set({
        fieldKey: data.fieldKey,
        type: data.fieldType,
        required: data.required,
        description: data.description,
        displayName: data.displayName,
        defaultValue: data.defaultValue,
        componentWhitelist: data.componentWhitelist,
        minValue: data.minValue,
        maxValue: data.maxValue,
        config: data.config
      })
      .where(
        and(
          eq(componentFields.organisationId, secure.organisationId),
          eq(componentFields.componentId, componentId),
          eq(componentFields.fieldKey, fieldKey),
          eq(componentFields.siteId, siteId)
        )
      )
      .returning()

    if (!componentField) {
      throw createError({ statusCode: 404, statusMessage: "Component Field Not Found" })
    }

    if ((data.fieldType === "option" || data.fieldType === "options") && data.options) {
      // Delete existing options.  Easier to delete and recreate than diff.
      await tx
        .delete(fieldOptions)
        .where(
          and(
            eq(fieldOptions.componentId, componentId),
            eq(fieldOptions.fieldKey, fieldKey),
            eq(fieldOptions.organisationId, secure.organisationId),
            eq(fieldOptions.siteId, siteId)
          )
        )

      // Insert/Update options
      for (const option of data.options) {
        await tx.insert(fieldOptions).values({
          componentId,
          fieldKey,
          optionName: option.optionName,
          optionValue: option.optionValue,
          siteId,
          organisationId: secure.organisationId
        })
      }
    }

    return componentField
  })

  return tx
})
