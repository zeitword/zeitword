import type { H3Event } from "h3"

import { nanoid } from "nanoid"
import { z } from "zod"

import { sessions } from "../database/schema"

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse)

  // Enforce rate limits
  await enforceLoginRateLimit(event, email)

  // Find user
  const user = await db.query.users.findFirst({
    where: { email }
  })
  if (!user) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Without a password, we can't login
  if (!user.password) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Verify password
  const isMatch = await verifyPassword(user.password, password)
  if (!isMatch) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if user is archived
  if (user.deletedAt) {
    throw createError({ statusCode: 401, message: "Account has been archived" })
  }

  // Create a user session
  const [session] = await db
    .insert(sessions)
    .values({
      token: nanoid(64),
      userId: user.id
    })
    .returning()

  if (!session) throw createError({ statusCode: 500, message: "Failed to create session" })

  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email!,
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
    limit: 15,
    ttl: 3600
  })

  if (!globalLimit || !localLimit) {
    throw createError({
      statusCode: 429,
      message: "Too many requests. Please try again later."
    })
  }
}
