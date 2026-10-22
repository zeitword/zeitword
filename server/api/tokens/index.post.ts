import { customAlphabet } from "nanoid"
import { z } from "zod"
import { personalAccessTokens } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const { secure, session } = await requireAppSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const nanoid = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    40
  )
  const secret = nanoid()
  const hashedSecret = await hashPassword(secret)
  const lastFourChars = secret.slice(-4)

  const token = await db.transaction(async (tx) => {
    await lockOrganisation(tx, secure.organisationId)
    const membership = await requireMembership(tx, secure.userId, secure.organisationId)
    if (membership.authVersion !== session.membershipVersion) {
      throw createError({ statusCode: 403, statusMessage: "Organisation access has changed" })
    }
    const [created] = await tx
      .insert(personalAccessTokens)
      .values({
        userId: secure.userId,
        organisationId: secure.organisationId,
        hash: hashedSecret,
        lastFourChars,
        name: data.name
      })
      .returning()
    return created!
  })

  const completeToken = `zwpat_${token.id}_${secret}`
  return {
    id: token.id,
    name: token.name,
    token: completeToken,
    lastFourChars,
    createdAt: token.createdAt
  }
})
