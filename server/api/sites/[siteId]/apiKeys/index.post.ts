import { customAlphabet } from "nanoid"
import { z } from "zod"
import { siteApiKeys, sites } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

const bodySchema = z.object({
  name: z.string()
})

const paramSchema = z.object({
  siteId: z.uuid()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { siteId } = await getValidatedRouterParams(event, paramSchema.parse)
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const nanoid = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    32
  )
  const secret = nanoid()
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
