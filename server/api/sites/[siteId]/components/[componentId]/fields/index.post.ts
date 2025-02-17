import { z } from "zod"
import { componentFields, components, fieldTypeEnum } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  // TODO: use fieldTypes from schema?
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
  ])
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [componentField] = await useDrizzle()
    .insert(componentFields)
    .values({
      componentId: componentId,
      fieldKey: data.name,
      type: data.fieldType,
      name: data.name,
      organisationId: secure.organisationId
    })
    .returning()

  return componentField
})
