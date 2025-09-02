import { z } from "zod"
import { siteApiKeys } from "~~/server/database/schema"

const bodySchema = z.object({
  id: z.uuid()
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

  await useDrizzle()
    .delete(siteApiKeys)
    .where(and(eq(siteApiKeys.id, data.id), eq(siteApiKeys.organisationId, secure.organisationId)))

  return {}
})
