import { and, eq, isNull } from "drizzle-orm"

import type { AuthDatabase } from "../auth"

import { organisationMembers, organisations } from "../database/schema"

// Serialise switching, invitation acceptance and removal within an organisation.
export async function lockOrganisation(database: AuthDatabase, organisationId: string) {
  const [organisation] = await database
    .select()
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), isNull(organisations.deletedAt)))
    .for("update")
  if (!organisation) throw createError({ statusCode: 404, statusMessage: "Organisation not found" })
  return organisation
}

export async function requireMembership(
  database: AuthDatabase,
  userId: string,
  organisationId: string,
  owner = false
) {
  const [membership] = await database
    .select()
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.userId, userId),
        eq(organisationMembers.organisationId, organisationId),
        isNull(organisationMembers.deletedAt)
      )
    )
  if (!membership || (owner && membership.role !== "owner")) {
    throw createError({
      statusCode: 403,
      statusMessage: owner ? "Only owners can manage members" : "Organisation access denied"
    })
  }
  return membership
}
