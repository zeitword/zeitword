import { z } from "zod"
import { userInvitations, users, organisations } from "~~/server/database/schema"
import { isNull } from "drizzle-orm"

const bodySchema = z
  .object({
    name: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token")
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: "Token is required" })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  // Get invitation
  const [invitation] = await useDrizzle()
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.token, token),
        isNull(userInvitations.acceptedAt),
        isNull(userInvitations.deletedAt)
      )
    )

  if (!invitation) {
    throw createError({ statusCode: 404, statusMessage: "Invitation not found" })
  }

  // Check if expired
  if (new Date() > new Date(invitation.expiresAt)) {
    throw createError({ statusCode: 400, statusMessage: "Invitation has expired" })
  }

  // Check if user already exists (double-check)
  const existingUser = await useDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1)

  if (existingUser.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "User already exists"
    })
  }

  // Hash password
  const hashedPassword = await hashPassword(body.password)

  // Create user
  const [newUser] = await useDrizzle()
    .insert(users)
    .values({
      name: body.name,
      email: invitation.email,
      password: hashedPassword,
      organisationId: invitation.organisationId
    })
    .returning()

  // Mark invitation as accepted
  await useDrizzle()
    .update(userInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(userInvitations.id, invitation.id))

  // Log the user in
  await setUserSession(event, {
    user: {
      userId: newUser.id,
      organisationId: newUser.organisationId
    },
    secure: {
      userId: newUser.id,
      organisationId: newUser.organisationId
    }
  })

  return { success: true }
})
