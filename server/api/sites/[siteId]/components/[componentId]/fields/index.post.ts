import { z } from "zod"
import { componentFields } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
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
  ]),
  order: z.string()
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Component ID"
    })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [componentField] = await useDrizzle()
    .insert(componentFields)
    .values({
      componentId: componentId,
      fieldKey: data.name,
      type: data.fieldType,
      order: data.order,
      displayName: data.displayName,
      siteId: siteId,
      organisationId: organisationId
    })
    .returning()

  return componentField
})
