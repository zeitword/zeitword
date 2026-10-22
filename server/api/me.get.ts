export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const user = await db.query.users.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
      organisationId: true,
      deletedAt: true
    },
    with: {
      organisation: {
        columns: { name: true }
      }
    },
    where: {
      id: secure.userId,
      organisationId: secure.organisationId
    }
  })

  // Check if user is archived
  if (user?.deletedAt) {
    throw createError({ statusCode: 401, statusMessage: "Account has been archived" })
  }

  if (!user?.organisation) return undefined

  const { organisation, ...userData } = user
  return {
    ...userData,
    organisationName: organisation.name
  }
})
