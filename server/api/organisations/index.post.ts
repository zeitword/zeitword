import { eq } from "drizzle-orm"
import { z } from "zod"

import { organisationMembers, organisations, sessions } from "../../database/schema"

export default defineEventHandler(async (event) => {
  const { user, session } = await requireAccountSession(event)
  const { name } = await readValidatedBody(
    event,
    z.object({ name: z.string().trim().min(1).max(255) }).strict().parse
  )
  await limitOnboarding(event)
  return db.transaction(async (tx) => {
    const [organisation] = await tx.insert(organisations).values({ name }).returning()
    await tx
      .insert(organisationMembers)
      .values({ userId: user.id, organisationId: organisation!.id, role: "owner" })
    await tx
      .update(sessions)
      .set({ organisationId: organisation!.id, membershipVersion: 0, updatedAt: new Date() })
      .where(eq(sessions.id, session.id))
    return organisation
  })
})
