import { and, eq, gt, isNull } from "drizzle-orm"
import { z } from "zod"
import {
  accounts,
  organisationMembers,
  sessions,
  userInvitations,
  users
} from "~~/server/database/schema"

const newAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    password: z.string().min(8).max(128),
    confirmPassword: z.string()
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match" })

export default defineEventHandler(async (event) => {
  requireAuthOrigin(event)
  const token = getRouterParam(event, "token")!
  const body = await readBody(event)
  await limitOnboarding(event)
  const current = await useAuth().api.getSession({ headers: authHeaders(event) })
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.token, token),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.deletedAt),
          gt(userInvitations.expiresAt, new Date())
        )
      )
      .for("update")
    if (!invitation)
      throw createError({ statusCode: 400, statusMessage: "Invitation is invalid or expired" })
    await lockOrganisation(tx, invitation.organisationId)
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.email, invitation.email))
      .for("update")
    let userId: string
    let signup: z.infer<typeof newAccountSchema> | undefined
    if (existing) {
      // Membership invitations must never reset an existing account's password.
      if (!current || current.user.id !== existing.id)
        throw createError({
          statusCode: 401,
          statusMessage: "Sign in with the invited email to accept"
        })
      if (existing.deletedAt)
        throw createError({ statusCode: 403, statusMessage: "Account is unavailable" })
      userId = existing.id
    } else {
      if (current)
        throw createError({
          statusCode: 403,
          statusMessage: "Sign out to create the invited account"
        })
      signup = newAccountSchema.parse(body)
      const [user] = await tx
        .insert(users)
        .values({ name: signup.name, email: invitation.email, emailVerified: true })
        .returning()
      userId = user!.id
      await tx.insert(accounts).values({
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(signup.password)
      })
    }
    const [membership] = await tx
      .insert(organisationMembers)
      .values({ userId, organisationId: invitation.organisationId })
      .onConflictDoUpdate({
        target: [organisationMembers.userId, organisationMembers.organisationId],
        set: { deletedAt: null, updatedAt: new Date() }
      })
      .returning()
    await tx.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
    await tx
      .update(userInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(userInvitations.id, invitation.id))
    if (current) {
      await tx
        .update(sessions)
        .set({
          organisationId: invitation.organisationId,
          membershipVersion: membership!.authVersion
        })
        .where(and(eq(sessions.id, current.session.id), eq(sessions.userId, userId)))
      return { success: true }
    }
    const response = await useAuth(tx).api.signInEmail({
      body: { email: invitation.email, password: signup!.password },
      headers: authHeaders(event),
      asResponse: true
    })
    if (!response.ok)
      throw createError({ statusCode: 400, statusMessage: "Unable to complete invitation" })
    return response
  })
})
