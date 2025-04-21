import { languages } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const allLanguages = await useDrizzle()
    .select({
      code: languages.code,
      name: languages.name,
      nativeName: languages.nativeName
    })
    .from(languages)
    .orderBy(languages.name)

  return allLanguages
})
