import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"

const optionSchema = z.object({
  id: z.string().uuid().optional(), // Optional because it might be new
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
  options: z.array(optionSchema).optional()
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

  // Validate min/max values based on field type
  if (data.fieldType === 'text' || data.fieldType === 'textarea') {
    if (data.defaultValue && data.minValue && data.defaultValue.length < data.minValue) {
      throw createError({
        statusCode: 400,
        statusMessage: `Default value length must be at least ${data.minValue} characters`
      });
    }
    
    if (data.defaultValue && data.maxValue && data.defaultValue.length > data.maxValue) {
      throw createError({
        statusCode: 400,
        statusMessage: `Default value length cannot exceed ${data.maxValue} characters`
      });
    }
  }
  
  if (data.fieldType === 'number') {
    if (data.defaultValue !== null && data.minValue !== null && Number(data.defaultValue) < data.minValue) {
      throw createError({
        statusCode: 400,
        statusMessage: `Default value must be at least ${data.minValue}`
      });
    }
    
    if (data.defaultValue !== null && data.maxValue !== null && Number(data.defaultValue) > data.maxValue) {
      throw createError({
        statusCode: 400,
        statusMessage: `Default value cannot exceed ${data.maxValue}`
      });
    }
  }
  
  // Make sure min is less than max if both are provided
  if (data.minValue !== null && data.maxValue !== null && data.minValue > data.maxValue) {
    throw createError({
      statusCode: 400,
      statusMessage: `Minimum value cannot be greater than maximum value`
    });
  }

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
        maxValue: data.maxValue
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
