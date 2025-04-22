import { useDrizzle, tables } from "~~/server/utils/drizzle"
import ISO6391 from "iso-639-1"

async function seedLanguages() {
  console.log("Starting language seeding...")
  const db = useDrizzle()

  try {
    // Get all languages from ISO-639-1
    const languagesList = ISO6391.getAllCodes().map((code) => ({
      code,
      name: ISO6391.getName(code),
      nativeName: ISO6391.getNativeName(code)
    }))

    console.log(`Found ${languagesList.length} languages to seed`)

    // Insert languages, ignoring duplicates
    const result = await db
      .insert(tables.languages)
      .values(languagesList)
      .onConflictDoNothing({ target: tables.languages.code })
      .returning()

    console.log(`Successfully seeded ${result.length} new languages`)
  } catch (error: any) {
    console.error("[ERROR]:", error.message || error)
    process.exit(1)
  }
}

seedLanguages()
  .then(() => {
    console.log("Seeding complete")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
  })
