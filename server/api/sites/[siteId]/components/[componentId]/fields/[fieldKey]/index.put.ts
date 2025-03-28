import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"
import { 
  createFieldValidationSchema, 
  validateField, 
  validateRouteParams,
  commonSchemas,
  fieldWithOptionsSchema
} from "~~/server/utils/validation"

// Enhanced schema with validation refinements
const bodySchema = createFieldValidationSchema(fieldWithOptionsSchema)

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Validate route parameters using Zod
  const { siteId, componentId, fieldKey } = validateRouteParams(event, {
    siteId: commonSchemas.siteId,
    componentId: commonSchemas.componentId,
    fieldKey: commonSchemas.fieldKey
  })

  // Use the enhanced validateField helper that handles Zod errors consistently
  const data = await validateField(event, bodySchema)

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
