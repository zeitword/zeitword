import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { sessions } from "../../../database/schema"

export default defineEventHandler(async (event) => {
  const { user, session } = await requireAccountSession(event)
  const organisationId = z.uuid().parse(getRouterParam(event, "organisationId"))
  await db.transaction(async (tx) => {
    await lockOrganisation(tx, organisationId)
    const membership = await requireMembership(tx, user.id, organisationId)
    await tx
      .update(sessions)
      .set({ organisationId, membershipVersion: membership.authVersion, updatedAt: new Date() })
      .where(and(eq(sessions.id, session.id), eq(sessions.userId, user.id)))
  })
  return { success: true }
})
