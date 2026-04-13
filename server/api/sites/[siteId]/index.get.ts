export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const id = getRouterParam(event, "siteId")
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle().query.sites.findMany({
    where: {
      id,
      organisationId
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

  return site
})
