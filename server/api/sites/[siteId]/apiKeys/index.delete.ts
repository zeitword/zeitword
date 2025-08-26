import { z } from "zod"
import { siteApiKeys } from "~~/server/database/schema"

const bodySchema = z.object({
    id: z.string()
})

export default defineEventHandler(async (event) => {
    const { secure } = await requireUserSession(event)
    if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

    const siteId = getRouterParam(event, "siteId")
    if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

    const data = await readValidatedBody(event, bodySchema.parse)

    await useDrizzle()
        .delete(siteApiKeys)
        .where(and(eq(siteApiKeys.id, data.id), eq(siteApiKeys.organisationId, secure.organisationId)))
        .returning()

    return {}
})