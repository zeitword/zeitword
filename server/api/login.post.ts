import { sessions, users } from "../database/schema"
import { nanoid } from "nanoid"
import { z } from "zod"
import type { H3Event } from "h3"

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse)

  // Enforce rate limits
  await enforceLoginRateLimit(event, email)

  // Find user
  const results = await useDrizzle().select().from(users).where(eq(users.email, email)).limit(1)
  if (results.length !== 1) throw createError({ statusCode: 401, message: "Bad credentials" })
  const user = results[0]

  // Without a password, we can't login
  if (!user.password) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Verify password
  const isMatch = await verifyPassword(user.password, password)
  if (!isMatch) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Create a user session
  const created = await useDrizzle()
    .insert(sessions)
    .values({
      token: nanoid(64),
      userId: user.id
    })
    .returning()

  const session = created[0]

  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email!,
      role: user.role,
      organisationId: user.organisationId
    },
    secure: {
      userId: user.id,
      sessionToken: session.token,
      organisationId: user.organisationId
    }
  })

  return {}
})

async function enforceLoginRateLimit(event: H3Event, email: string) {
  const rateLimiter = useRateLimiter()

  // Check global rate limit
  const globalLimit = await rateLimiter.checkLimit({
    key: "limit:login:global",
    limit: 100,
    ttl: 3600
  })

  // Check per-email rate limit
  const localLimit = await rateLimiter.checkLimit({
    key: `limit:login:${email}`,
    limit: 3,
    ttl: 3600
  })

  if (!globalLimit || !localLimit) {
    throw createError({
      statusCode: 429,
      message: "Too many requests. Please try again later."
    })
  }
}
