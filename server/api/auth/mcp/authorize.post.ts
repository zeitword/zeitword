import { customAlphabet } from "nanoid"
import { z } from "zod"
import { personalAccessTokens } from "~~/server/database/schema"

const bodySchema = z.object({
  callbackPort: z.number().int().min(1024).max(65535)
})

/**
 * Called by the MCP auth page after the user confirms authorization.
 * Creates a PAT and returns it + the callback URL to redirect to.
 * Requires an active user session (the user must be logged in).
 */
export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { callbackPort } = await readValidatedBody(event, bodySchema.parse)

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
      name: `MCP (${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })})`
    })
    .returning()

  const completeToken = `zwpat_${token.id}_${secret}`

  return {
    token: completeToken,
    callbackUrl: `http://localhost:${callbackPort}/callback`
  }
})
