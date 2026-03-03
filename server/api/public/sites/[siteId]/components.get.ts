export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const componentResults = await useDrizzle().query.components.findMany({
    with: {
      fields: {},
      fieldOptions: {}
    },
    where: { siteId }
  })

  // set cors header
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type")
  setResponseHeader(event, "Content-Type", "application/json")

  return componentResults
})
