export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const id = getRouterParam(event, "siteId")
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle().query.sites.findMany({
    where: {
      id,
      organisationId,
      deletedAt: { isNull: true }
    },
    with: {
      languages: {
        with: {
          language: true
        }
      },
      defaultLang: true
    }
  })

  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })
  return site
})
