// bun run scripts/move-site-to-org.ts <siteId> <newOrganizationId> [--dry-run]
import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"

async function moveSiteToOrganization(siteId: string, newOrganizationId: string) {
  const isDryRun = process.argv.includes("--dry-run")
  console.log(`\n-- ${isDryRun ? "DRY RUN" : "LIVE RUN"} MODE --`)

  const db = useDrizzle()

  try {
    // First, verify the site exists
    const site = await db.query.sites.findFirst({
      where: eq(tables.sites.id, siteId)
    })

    if (!site) {
      console.error(`Site with ID ${siteId} not found`)
      process.exit(1)
    }

    console.log(`Moving site "${site.name}" to new organization...`)

    if (!isDryRun) {
      await db.transaction(async (tx) => {
        const now = new Date()

        await tx
          .update(tables.sites)
          .set({ organisationId: newOrganizationId, updatedAt: now })
          .where(eq(tables.sites.id, siteId))

        await tx
          .update(tables.stories)
          .set({ organisationId: newOrganizationId, updatedAt: now })
          .where(eq(tables.stories.siteId, siteId))

        await tx
          .update(tables.components)
          .set({ organisationId: newOrganizationId, updatedAt: now })
          .where(eq(tables.components.siteId, siteId))

        await tx
          .update(tables.componentFields)
          .set({ organisationId: newOrganizationId })
          .where(eq(tables.componentFields.siteId, siteId))

        await tx
          .update(tables.fieldOptions)
          .set({ organisationId: newOrganizationId })
          .where(eq(tables.fieldOptions.siteId, siteId))
      })

      console.log("Migration completed successfully")
    } else {
      console.log("Dry run completed - no changes made")
    }
  } catch (error) {
    console.error("Error during site migration:", error)
    process.exit(1)
  }
}

const [, , siteId, newOrganizationId] = process.argv

if (!siteId || !newOrganizationId) {
  console.error("Usage: ts-node scripts/move-site.ts <siteId> <newOrganizationId> [--dry-run]")
  process.exit(1)
}

moveSiteToOrganization(siteId, newOrganizationId).catch((error) => {
  console.error("Migration script failed:", error)
  process.exit(1)
})
