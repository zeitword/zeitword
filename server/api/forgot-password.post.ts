import { users } from "../database/schema"
import { nanoid } from "nanoid"
import { z } from "zod"
import type { H3Event } from "h3"

const bodySchema = z.object({
  email: z.string().email(),
})

export default defineEventHandler(async (event) => {
  const { email } = await readValidatedBody(event, bodySchema.parse)

  await enforceForgotPasswordRateLimit(event, email.toLowerCase())

  // schedule a background task without blocking the response
  event.waitUntil(backgroundProcessEmail({ email }))

  // immediately send the response to the client
  return {}
})

async function enforceForgotPasswordRateLimit(event: H3Event, email: string) {
  const rateLimiter = useRateLimiter()

  // Check global rate limit
  const globalLimit = await rateLimiter.checkLimit({
    key: "limit:forgot-password:global",
    limit: 100,
    ttl: 3600,
  })

  // Check per-email rate limit
  const localLimit = await rateLimiter.checkLimit({
    key: `limit:forgot-password:${email}`,
    limit: 3,
    ttl: 3600,
  })

  if (!globalLimit || !localLimit) {
    throw createError({
      statusCode: 429,
      message: "Too many requests. Please try again later.",
    })
  }
}

async function backgroundProcessEmail({ email }: { email: string }) {
  const result = await useDrizzle().select().from(users).where(eq(users.email, email)).limit(1)
  if (result.length !== 1) throw createError({ statusCode: 401, message: "Bad credentials" })
  const user = result[0]

  if (!user.email) return {}

  // Process the user's password reset request
  const config = useRuntimeConfig()

  const postmark = usePostmark({ serverToken: config.postmarkServerToken })

  const passwordResetToken = nanoid(64)
  const resetLink = `https://app.zeitword.com/reset-password?token=${passwordResetToken}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  // Set the reset password token and expiration date
  await useDrizzle().update(users).set({ resetPasswordToken: passwordResetToken, resetPasswordExpiresAt: expiresAt }).where(eq(users.id, user.id))

  try {
    const emailResult = await postmark.sendEmail({
      from: "Zeitword Support <support@zeitword.com>",
      to: user.email,
      subject: "Passwort zurücksetzen",
      htmlBody:
        `<p>Hallo ${user.name},</p>` +
        `<p>du hast eine Anfrage zum Zurücksetzen deines Passworts für Zeitword erhalten. Um dein Passwort zurückzusetzen, klicke bitte auf den folgenden Link:</p>` +
        `<p><a href="${resetLink}">Passwort zurücksetzen</a></p>` +
        `<p>Wenn du diese E-Mail nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>` +
        `<p>Vielen Dank<br />Dein Zeitword Team</p>`,
    })

    console.log(emailResult)
  } catch (error) {
    console.error(error)
  }

  return {}
}
