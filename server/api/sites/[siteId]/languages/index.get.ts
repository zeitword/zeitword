import { eq, and } from "drizzle-orm"
import { siteLanguages, languages, sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  const { organisationId } = secure

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }

  const siteLangs = await useDrizzle()
    .select({
      code: languages.code,
      name: languages.name,
      nativeName: languages.nativeName
    })
    .from(siteLanguages)
    .innerJoin(languages, eq(siteLanguages.languageCode, languages.code))
    .innerJoin(sites, eq(siteLanguages.siteId, sites.id))
    .where(and(eq(siteLanguages.siteId, siteId), eq(sites.organisationId, organisationId)))
    .orderBy(languages.name)

  return siteLangs
})
