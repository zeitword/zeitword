import { requireApiKey } from "~~/server/utils/api-key-auth"
import { components } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

export default defineEventHandler(async (event) => {
    const auth = await requireApiKey(event)

    const siteComponents = await useDrizzle()
        .select()
        .from(components)
        .where(and(
            eq(components.siteId, auth.siteId),
            eq(components.organisationId, auth.organisationId)
        ))

    return siteComponents
})