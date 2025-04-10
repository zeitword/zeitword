import { z } from "zod"
import { sites } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [site] = await useDrizzle()
    .insert(sites)
    .values({
      name: data.name,
      domain: data.domain || "",
      organisationId: secure.organisationId
    })
    .returning()
  return site
})
