import { getTableColumns, inArray } from "drizzle-orm"
import { z } from "zod"
import type { DComponent, DField } from "~~/app/types/models"
import { componentFields, components } from "~~/server/database/schema"

const assetSchema = z.object({
    id: z.string().uuid().optional(),
    alt: z.string().min(1),
    src: z.string().min(1),
    type: z.enum(["image", "video", "audio", "pdf", "other"])
})

const linkTyoe = z.enum(["external", "internal"])
const linkSchema = z.discriminatedUnion('type', [
    z.object({
        type: linkTyoe.extract(['external']),
        url: z.string().min(1)
    }),
    z.object({
        type: linkTyoe.extract(['internal']),
        storyId: z.uuid().optional()
    })
])

const getValidationSchemaForField = async (field: DField, data: unknown, organisationId: string, siteId: string) => {
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
                if (Array.isArray(data)) {
                    const blocks = data as { componentId: string, content: any }[]

                    const blockDefinitions = await useDrizzle()
                        .select({ name: components.name, id: components.id })
                        .from(components)
                        .where(and(inArray(components.id, blocks.map(b => b.componentId)), eq(components.organisationId, organisationId), eq(components.siteId, siteId)))

                    const allowedBlockNames = (field.componentWhitelist || []) as string[]

                    for (const component of blocks) {
                        schemas.push(z.object({
                            id: z.uuid(),
                            componentId: z.uuid().refine(id => {
                                const block = blockDefinitions.find(b => b.id === id)
                                const isAllowed = allowedBlockNames.includes(block?.name.toLowerCase() || "")
                                return block && isAllowed
                            }, { message: `Invalid component ID: ${component.componentId}, types must be in whitelist` }),
                            content: await getValidationSchemaForComponent(component.componentId, component.content, organisationId, siteId)
                        }))
                    }
                }
            } catch (error) {
            }

            return schemas.length > 0 ? z.array(z.union(schemas as any)) : z.array(z.object({
                id: z.uuid(),
                componentId: z.uuid(),
                content: z.any()
            }))
        default:
            return z.string()
    }
}

export const getValidationSchemaForComponent = async (componentId: string, data: { [key: string]: unknown }, organisationId: string, siteId: string): Promise<z.ZodTypeAny> => {
    let schema = z.object({})

    try {
        const fields = await useDrizzle()
            .select()
            .from(componentFields)
            .where(and(eq(componentFields.componentId, componentId), eq(componentFields.organisationId, organisationId), eq(componentFields.siteId, siteId)))
       
        for (const field of fields) {
            const fieldSchema = await getValidationSchemaForField(field, data[field.fieldKey], organisationId, siteId)

            schema = schema.extend({
                [field.fieldKey]: field.required ? fieldSchema : fieldSchema.optional()
            })
        }
    }
    catch (error) { }

    return schema
}