import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { componentFields, components } from "~~/server/database/schema"

// Types for data structures
type BlockData = {
  componentId: string
  content: Record<string, unknown>
}

type ComponentData = Record<string, unknown>

const assetSchema = z.object({
  id: z.uuid().optional(),
  alt: z.string().min(1),
  src: z.string().min(1),
  type: z.enum(["image", "video", "audio", "pdf", "other"])
})

const linkType = z.enum(["external", "internal"])
const linkSchema = z.discriminatedUnion("type", [
  z.object({
    type: linkType.extract(["external"]),
    url: z.string().min(1)
  }),
  z.object({
    type: linkType.extract(["internal"]),
    storyId: z.string().uuid().optional()
  })
])

function buildValidationSchemaForField(
  field: ComponentDefinition,
  componentData: ComponentData,
  componentDefinitions: ComponentDefinitions
): z.ZodTypeAny {
  switch (field.type) {
    case "assets":
      return z.array(assetSchema)
    case "asset":
      return assetSchema
    case "number":
      return z.number()
    case "datetime":
      return z.date()
    case "boolean":
      return z.boolean()
    case "link":
      return linkSchema
    case "blocks":
      const schemas = []

      try {
        if (Array.isArray(componentData)) {
          const blocks = componentData as BlockData[]
          const allowedBlockNames = (field.componentWhitelist || []) as string[]

          for (const block of blocks) {
            const blockDefinition = componentDefinitions.find(
              (c) => c.componentId === block.componentId
            )
            const isAllowed = allowedBlockNames.includes(
              blockDefinition?.componentName.toLowerCase() || ""
            )

            schemas.push(
              z.object({
                id: z.uuid(),
                componentId: z.uuid().refine(
                  (id: string) => {
                    return blockDefinition && isAllowed
                  },
                  {
                    message: `Invalid component ID: ${block.componentId}, types must be in whitelist`
                  }
                ),
                content: buildValidationSchemaForComponent(
                  block.componentId,
                  block.content,
                  componentDefinitions
                )
              })
            )
          }
        }
      } catch (error) {
        // Silently handle errors and return fallback schema
      }

      return schemas.length > 0
        ? z.array(z.union(schemas as any))
        : z.array(
            z.object({
              id: z.uuid(),
              componentId: z.uuid(),
              content: z.any()
            })
          )
    default:
      return z.string()
  }
}

function buildValidationSchemaForComponent(
  componentId: string,
  componentData: ComponentData,
  componentDefinitions: ComponentDefinitions
): z.ZodTypeAny {
  let schema = z.object({})

  try {
    const fields = componentDefinitions.filter((c) => c.componentId === componentId) || []

    for (const field of fields) {
      if (!field.fieldKey) continue

      const fieldSchema = buildValidationSchemaForField(
        field,
        componentData[field.fieldKey] as ComponentData,
        componentDefinitions
      )

      schema = schema.extend({
        [field.fieldKey]: field.required ? fieldSchema : fieldSchema.optional()
      })
    }
  } catch (error) {}

  return schema
}

/**
 * Recursively collects all component IDs from nested data structures
 */
function collectComponentIds(data: unknown, componentIds: Set<string>): void {
  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (item && typeof item === "object") {
        if ("componentId" in item && typeof item.componentId === "string") {
          componentIds.add(item.componentId)
        }
        collectComponentIds(item, componentIds)
      }
    })
  } else if (data && typeof data === "object") {
    Object.values(data).forEach((value) => collectComponentIds(value, componentIds))
  }
}

type ComponentDefinitions = Awaited<ReturnType<typeof getComponentDefinitions>>
type ComponentDefinition = ComponentDefinitions[number]
async function getComponentDefinitions(
  componentIds: string[],
  organisationId: string,
  siteId: string
) {
  return await useDrizzle()
    .select({
      componentId: components.id,
      componentName: components.name,
      fieldKey: componentFields.fieldKey,
      type: componentFields.type,
      required: componentFields.required,
      componentWhitelist: componentFields.componentWhitelist
    })
    .from(components)
    .leftJoin(
      componentFields,
      and(
        eq(components.id, componentFields.componentId),
        eq(componentFields.organisationId, organisationId),
        eq(componentFields.siteId, siteId)
      )
    )
    .where(
      and(
        inArray(components.id, Array.from(componentIds)),
        eq(components.organisationId, organisationId),
        eq(components.siteId, siteId)
      )
    )
}

export async function getValidationSchemaForComponent(
  componentId: string,
  data: ComponentData,
  organisationId: string,
  siteId: string
): Promise<z.ZodTypeAny> {
  const componentIds = new Set<string>([componentId])
  collectComponentIds(data, componentIds)

  const componentDefinitions = await getComponentDefinitions(
    Array.from(componentIds),
    organisationId,
    siteId
  )

  return buildValidationSchemaForComponent(componentId, data, componentDefinitions)
}
