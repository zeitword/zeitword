import { z } from "zod"
import { waitlist } from "~~/server/database/schema"
import { createHash } from "crypto"
import { Resend } from "resend"

const bodySchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "POST")
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type")

  const config = useRuntimeConfig()
  const resend = new Resend(config.resend)

  const data = await readValidatedBody(event, bodySchema.parse)

  // Generate a confirmation token
  const confirmationToken = createHash("sha256")
    .update(data.email + Date.now().toString())
    .digest("hex")

  try {
    const [entry] = await useDrizzle()
      .insert(waitlist)
      .values({
        email: data.email,
        confirmationToken
      })
      .returning()

    // Send confirmation email
    await resend.emails.send({
      from: "Zeitword <no-reply@zeitword.com>",
      to: data.email,
      subject: "Confirm your Zeitword waitlist spot",
      html: `
        <h1>Welcome to Zeitword!</h1>
        <p>Thank you for joining our waitlist. Please confirm your email by clicking the link below:</p>
        <a href="${config.public.siteUrl}/waitlist/confirm/${confirmationToken}">
          Confirm your email
        </a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `
    })

    return { success: true }
  } catch (error) {
    if (error.code === "23505") {
      // Unique violation
      throw createError({
        statusCode: 400,
        statusMessage: "Email already registered"
      })
    }
    throw error
  }
})
