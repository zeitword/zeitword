import { addDays } from "date-fns"
import { nanoid } from "nanoid"
import { Resend } from "resend"
import { z } from "zod"
import {
  userInvitations,
  users,
  organisations,
  organisationMembers
} from "~~/server/database/schema"

const bodySchema = z.object({
  email: z.email()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { email } = await readValidatedBody(event, bodySchema.parse)
  const normalizedEmail = email.toLowerCase()

  // Check if user already exists
  const [existingUser] = await useDrizzle()
    .select()
    .from(users)
    .innerJoin(organisationMembers, eq(organisationMembers.userId, users.id))
    .where(
      and(
        eq(users.email, normalizedEmail),
        eq(organisationMembers.organisationId, secure.organisationId),
        isNull(organisationMembers.deletedAt)
      )
    )
    .limit(1)

  if (existingUser) {
    throw createError({
      statusCode: 400,
      statusMessage: "This user is already a member of this organisation"
    })
  }

  // Get organization name for email
  const [org] = await useDrizzle()
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, secure.organisationId))
  if (!org) throw createError({ statusCode: 404, statusMessage: "Organisation not found" })

  // Generate token and set expiry to 30 days
  const token = nanoid(64)
  const expiresAt = addDays(new Date(), 30)

  // Invitations are scoped to one organisation, including resends.
  const [existingInvitation] = await useDrizzle()
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.email, normalizedEmail),
        eq(userInvitations.organisationId, secure.organisationId)
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
        organisationId: secure.organisationId,
        acceptedAt: null,
        deletedAt: null,
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
  const acceptLink = `${config.public.appUrl}/accept-invitation/${token}`

  try {
    const resend = new Resend(config.resend)
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

  // The token is mailbox proof at acceptance. Do not return it to the inviter.
  return {
    success: true,
    invitation: invitation
      ? { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt }
      : undefined
  }
})
