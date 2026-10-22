export default defineEventHandler(async (event) => {
  const { user, secure } = await requireAppSession(event)
  const organisation = await db.query.organisations.findFirst({
    where: { id: secure.organisationId },
    columns: { name: true }
  })
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organisationId: secure.organisationId,
    organisationName: organisation!.name,
    role: secure.role
  }
})
