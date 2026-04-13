import { customAlphabet } from "nanoid"
import { z } from "zod"
import { personalAccessTokens } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const nanoid = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    40
  )
  const secret = nanoid()
  const hashedSecret = await hashPassword(secret)
  const lastFourChars = secret.slice(-4)

  const [token] = await useDrizzle()
    .insert(personalAccessTokens)
    .values({
      userId: secure.userId,
      organisationId: secure.organisationId,
      hash: hashedSecret,
      lastFourChars,
      name: data.name
    })
    .returning()

  const completeToken = `zwpat_${token.id}_${secret}`
  return {
    id: token.id,
    name: token.name,
    token: completeToken,
    lastFourChars,
    createdAt: token.createdAt
  }
})
