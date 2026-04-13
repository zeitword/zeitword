import { eq, and } from "drizzle-orm"
import { siteLanguages, languages } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

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
    .where(eq(siteLanguages.siteId, siteId))
    .orderBy(languages.name)

  return siteLangs
})
