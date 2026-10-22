export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const allLanguages = await db.query.languages.findMany({
    columns: {
      code: true,
      name: true,
      nativeName: true
    },
    orderBy: { name: "asc" }
  })

  return allLanguages
})
