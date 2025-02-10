import { documents } from "~~/server/database/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const paramsSchema = z.object({
  id: z.string(),
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  const params = await getValidatedRouterParams(event, paramsSchema.parse)

  const result = await useDrizzle().select().from(documents).where(eq(documents.id, params.id))
  if (!result.length) throw createError({ statusCode: 404, message: "File not found" })
  const file = result[0]

  const buffer = await useS3Storage().getItemRaw(file.id)

  let fileType = file.type
  if (fileType === "x-zeitword/invoice") {
    fileType = "application/pdf"
  }

  setHeader(event, "Content-Type", fileType)
  // setHeader(event, "Content-Length", file.size)
  setHeader(event, "Cache-Control", "max-age=31536000")

  return new Response(buffer)
})
