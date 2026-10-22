import { and, eq, isNull } from "drizzle-orm"

import { organisationMembers, organisations } from "../../database/schema"

export default defineEventHandler(async (event) => {
  const { user, session } = await requireAccountSession(event)
  const memberships = await db
    .select({ id: organisations.id, name: organisations.name, role: organisationMembers.role })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
    .where(
      and(
        eq(organisationMembers.userId, user.id),
        isNull(organisationMembers.deletedAt),
        isNull(organisations.deletedAt)
      )
    )
    .orderBy(organisations.name, organisations.id)
  return { organisations: memberships, activeOrganisationId: session.organisationId ?? null }
})
