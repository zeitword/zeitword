import { sites, languages, siteLanguages } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const id = getRouterParam(event, "siteId")
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle().query.sites.findMany({
    where: and(eq(sites.id, id), eq(sites.organisationId, secure.organisationId)),
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
