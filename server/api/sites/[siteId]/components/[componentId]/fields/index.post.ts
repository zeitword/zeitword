import { z } from "zod"
import { componentFields } from "~~/server/database/schema"
import { 
  createFieldValidationSchema, 
  validateField, 
  validateRouteParams, 
  commonSchemas,
  fieldTypeEnum
} from "~~/server/utils/validation"

// Base schema for field creation
const baseBodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  fieldType: fieldTypeEnum,
  order: z.string(),
  required: z.boolean().default(false),
  description: z.string().max(255).nullable().default(null),
  defaultValue: z.string().max(255).nullable().default(null),
  minValue: z.number().min(0).nullable().default(null),
  maxValue: z.number().min(0).nullable().default(null),
  componentWhitelist: z.array(z.string()).optional()
})

// Enhanced schema with validation refinements
const bodySchema = createFieldValidationSchema(baseBodySchema)

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Validate route parameters using Zod
  const { siteId, componentId } = validateRouteParams(event, {
    siteId: commonSchemas.siteId,
    componentId: commonSchemas.componentId
  })

  const data = await validateField(event, bodySchema)

  const [componentField] = await useDrizzle()
    .insert(componentFields)
    .values({
      componentId: componentId,
      fieldKey: data.name,
      type: data.fieldType,
      order: data.order,
      displayName: data.displayName,
      required: data.required,
      description: data.description,
      defaultValue: data.defaultValue,
      minValue: data.minValue,
      maxValue: data.maxValue,
      componentWhitelist: data.componentWhitelist,
      siteId: siteId,
      organisationId: secure.organisationId
    })
    .returning()

  return componentField
})
