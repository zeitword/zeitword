import { userInvitations, users, organisations } from "~~/server/database/schema"
import { isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { Resend } from "resend"
import { addDays } from "date-fns"
import { z } from "zod"

const bodySchema = z.object({
  email: z.email()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { email } = await readValidatedBody(event, bodySchema.parse)
  const normalizedEmail = email.toLowerCase()

  // Check if user already exists
  const existingUser = await useDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existingUser.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Cannot invite user as they are already part of another organization"
    })
  }

  // Check if there's already a pending invitation
  const existingInvitation = await useDrizzle()
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.email, normalizedEmail),
        isNull(userInvitations.acceptedAt),
        isNull(userInvitations.deletedAt)
      )
    )
    .limit(1)

  if (existingInvitation.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "An invitation has already been sent to this email"
    })
  }

  // Get organization name for email
  const [org] = await useDrizzle()
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, secure.organisationId))

  // Generate token and set expiry to 30 days
  const token = nanoid(64)
  const expiresAt = addDays(new Date(), 30)

  // Create invitation
  const [invitation] = await useDrizzle()
    .insert(userInvitations)
    .values({
      email: normalizedEmail,
      token,
      invitedBy: secure.userId,
      organisationId: secure.organisationId,
      expiresAt
    })
    .returning()

  // Send invitation email
  const config = useRuntimeConfig()
  const resend = new Resend(config.resend)
  const acceptLink = `${config.public.appUrl}/accept-invitation/${token}`

  try {
    await resend.emails.send({
      from: "Zeitword <no-reply@zeitword.com>",
      to: normalizedEmail,
      subject: `You're invited to join ${org.name} on Zeitword`,
      html: `
        <h1>You've been invited to join ${org.name}</h1>
        <p>Click the link below to accept the invitation and create your account. This link is valid for 30 days.</p>
        <p><a href="${acceptLink}">Accept Invitation</a></p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `
    })
  } catch (error) {
    console.error("Failed to send invitation email:", error)
    // Don't throw error - invitation is created, email failure shouldn't block the process
  }

  return { success: true, invitation }
})
