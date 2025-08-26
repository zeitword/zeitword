import { nanoid } from "nanoid"
import { z } from "zod"
import { siteApiKeys } from "~~/server/database/schema"

const bodySchema = z.object({
    name: z.string()
})

export default defineEventHandler(async (event) => {
    const { secure } = await requireUserSession(event)
    if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  
    const siteId = getRouterParam(event, "siteId")
    if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

    const data = await readValidatedBody(event, bodySchema.parse)

    const secret = nanoid(32)
    const hashedSecret = await hashPassword(secret)

    const [apiKey] = await useDrizzle()
        .insert(siteApiKeys)
        .values({
            siteId: siteId,
            organisationId: secure.organisationId,
            hash: hashedSecret,
            name: data.name
        })
        .returning()

    const completeKey = `zeitword_${apiKey.id}_${secret}`  
    return {
        id: apiKey.id,
        name: apiKey.name,
        organisationId: apiKey.organisationId,
        key: completeKey
    }
})  