import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import {
  accounts,
  organisations,
  personalAccessTokens,
  sessions,
  userInvitations,
  users,
  verifications
} from "~~/server/database/schema"

const bodySchema = z
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
  const body = await readValidatedBody(event, bodySchema.parse)
  await limitOnboarding(event)
  const password = await hashPassword(body.password)
  return db.transaction(async (tx) => {
    // Lock before consuming, so competing accept requests cannot both succeed.
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
    const [organisation] = await tx
      .select()
      .from(organisations)
      .where(and(eq(organisations.id, invitation.organisationId), isNull(organisations.deletedAt)))
    if (!organisation)
      throw createError({ statusCode: 400, statusMessage: "Organisation is unavailable" })
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.email, invitation.email))
      .for("update")
    if (existing && !existing.deletedAt)
      throw createError({
        statusCode: 409,
        statusMessage: "This account is already active. Sign in instead."
      })

    let user
    if (existing) {
      // The emailed secret proves ownership. Reactivation/transfer happens only
      // here, never when the invitation is sent. Revoke old organisation access.
      await tx.delete(sessions).where(eq(sessions.userId, existing.id))
      await tx
        .update(personalAccessTokens)
        .set({ deletedAt: new Date() })
        .where(eq(personalAccessTokens.userId, existing.id))
      await tx.delete(verifications).where(eq(verifications.value, existing.id))
      ;[user] = await tx
        .update(users)
        .set({
          name: body.name,
          organisationId: invitation.organisationId,
          deletedAt: null,
          emailVerified: true,
          updatedAt: new Date(),
          authVersion: sql`${users.authVersion} + 1`
        })
        .where(eq(users.id, existing.id))
        .returning()
    } else {
      ;[user] = await tx
        .insert(users)
        .values({
          name: body.name,
          email: invitation.email,
          emailVerified: true,
          organisationId: invitation.organisationId
        })
        .returning()
    }
    if (!user) throw new Error("Failed to create user")
    await tx
      .insert(accounts)
      .values({
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password
      })
      .onConflictDoUpdate({
        target: [accounts.providerId, accounts.accountId],
        set: { password, updatedAt: new Date() }
      })
    await tx
      .update(userInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(userInvitations.id, invitation.id))
    const response = await useAuth(tx).api.signInEmail({
      body: { email: user.email, password: body.password },
      headers: authHeaders(event),
      asResponse: true
    })
    if (!response.ok)
      throw createError({ statusCode: 400, statusMessage: "Unable to complete invitation" })
    return response
  })
})
