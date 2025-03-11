import { components } from "~~/server/database/schema"
import { eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const componentResults = await useDrizzle().query.components.findMany({
    with: {
      fields: {
        with: {
          options: {}
        }
      }
    },
    where: eq(components.siteId, siteId)
  })

  // set cors header
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return componentResults
})
