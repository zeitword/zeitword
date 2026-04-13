// zeitword/server/api/sites/index.post.ts
import { z } from "zod"
import { sites, siteLanguages } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  defaultLanguage: z.string().default("en")
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const data = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  // Create site with default language
  const [site] = await db
    .insert(sites)
    .values({
      name: data.name,
      domain: data.domain || "",
      organisationId: organisationId,
      defaultLanguage: data.defaultLanguage
    })
    .returning()

  // Create default language entry
  await db.insert(siteLanguages).values({
    siteId: site.id,
    languageCode: data.defaultLanguage
  })

  return site
})
