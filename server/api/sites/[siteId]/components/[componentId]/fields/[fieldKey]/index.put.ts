import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { componentFields, fieldOptions } from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Literal = z.infer<typeof literalSchema>
type Json = Literal | { [key: string]: Json } | Json[]

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(z.string(), jsonSchema)])
)

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  optionName: z.string().min(1),
  optionValue: z.string().min(1)
})

const bodySchema = z.object({
  fieldKey: z.string().min(1).max(255).optional(),
  order: z.string().optional(),
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
  ]).optional(),
  required: z.boolean().optional(),
  description: z.string().max(255).nullable().optional(),
  displayName: z.string().max(255).nullable().optional(),
  defaultValue: literalSchema.optional(),
  minValue: z.number().min(0).nullable().optional(),
  maxValue: z.number().min(0).nullable().optional(),
  componentWhitelist: z.array(z.string()).optional(),
  options: z.array(optionSchema).optional(),
  config: jsonSchema.optional()
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

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
    const updateData: Record<string, unknown> = {}
    if (data.fieldKey !== undefined) updateData.fieldKey = data.fieldKey
    if (data.order !== undefined) updateData.order = data.order
    if (data.fieldType !== undefined) updateData.type = data.fieldType
    if (data.required !== undefined) updateData.required = data.required
    if (data.description !== undefined) updateData.description = data.description
    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue
    if (data.componentWhitelist !== undefined) updateData.componentWhitelist = data.componentWhitelist
    if (data.minValue !== undefined) updateData.minValue = data.minValue
    if (data.maxValue !== undefined) updateData.maxValue = data.maxValue
    if (data.config !== undefined) updateData.config = data.config

    const [componentField] = await tx
      .update(componentFields)
      .set(updateData)
      .where(
        and(
          eq(componentFields.organisationId, organisationId),
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
            eq(fieldOptions.organisationId, organisationId),
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
          organisationId: organisationId
        })
      }
    }

    return componentField
  })

  return tx
})
