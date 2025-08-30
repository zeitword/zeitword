import { nanoid } from "nanoid"
import { z } from "zod"
import { siteApiKeys, sites } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

const bodySchema = z.object({
  name: z.string()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const secret = nanoid(32).replaceAll("-", "").replaceAll("_", "")
  const hashedSecret = await hashPassword(secret)

  const [site] = await useDrizzle()
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.organisationId, secure.organisationId)))
  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

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
