import { addDays } from "date-fns"
import { isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { Resend } from "resend"
import { z } from "zod"
import { userInvitations, users, organisations } from "~~/server/database/schema"

const bodySchema = z.object({
  email: z.email()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { email } = await readValidatedBody(event, bodySchema.parse)
  const normalizedEmail = email.toLowerCase()

  // Check if user already exists
  const [existingUser] = await useDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existingUser) {
    if (!existingUser.deletedAt) {
      // Active user — cannot invite someone already in an org
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot invite user as they are already part of another organization"
      })
    }

    // Archived user — unarchive them and move to this org
    await useDrizzle()
      .update(users)
      .set({ deletedAt: null, organisationId: secure.organisationId, updatedAt: new Date() })
      .where(eq(users.id, existingUser.id))
  }

  // Get organization name for email
  const [org] = await useDrizzle()
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, secure.organisationId))

  // Generate token and set expiry to 30 days
  const token = nanoid(64)
  const expiresAt = addDays(new Date(), 30)

  // Check if there's already a pending invitation — if so, update it instead of creating a new one
  const [existingInvitation] = await useDrizzle()
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

  let invitation: typeof existingInvitation
  if (existingInvitation) {
    ;[invitation] = await useDrizzle()
      .update(userInvitations)
      .set({
        token,
        expiresAt,
        invitedBy: secure.userId,
        updatedAt: new Date()
      })
      .where(eq(userInvitations.id, existingInvitation.id))
      .returning()
  } else {
    ;[invitation] = await useDrizzle()
      .insert(userInvitations)
      .values({
        email: normalizedEmail,
        token,
        invitedBy: secure.userId,
        organisationId: secure.organisationId,
        expiresAt
      })
      .returning()
  }

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
