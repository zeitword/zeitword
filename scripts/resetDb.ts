// scripts/resetDb.ts
import { useDrizzle, sql } from "../server/utils/drizzle"

async function resetDb() {
  const db = useDrizzle()

  if (!process.env.NUXT_DSN) {
    console.error("Error: NUXT_DSN environment variable not set.")
    process.exit(1)
  }

  console.log("Starting database reset...")

  try {
    await db.transaction(async (tx) => {
      console.log("Disabling triggers...")
      await tx.execute(sql`SET session_replication_role = 'replica';`)
      console.log("Triggers disabled.")

      // Drop tables
      console.log("Fetching table names...")
      const tables = await tx.execute(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      )
      console.log(`Found ${tables.rows.length} tables.`)
      for (const table of tables.rows) {
        console.log(`Dropping table: ${table.tablename}...`)
        await tx.execute(sql.raw(`DROP TABLE IF EXISTS "public"."${table.tablename}" CASCADE;`))
        console.log(`Table dropped: ${table.tablename}`)
      }
      console.log("All tables dropped.")

      // Drop custom types (enums)
      console.log("Fetching custom type names...")
      const types = await tx.execute(
        sql`SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e';`
      )
      console.log(`Found ${types.rows.length} custom types.`)
      for (const type of types.rows) {
        console.log(`Dropping type: ${type.typname}...`)
        await tx.execute(sql.raw(`DROP TYPE IF EXISTS "public"."${type.typname}" CASCADE;`))
        console.log(`Type dropped: ${type.typname}`)
      }
      console.log("All custom types dropped.")

      // Drop sequences
      console.log("Fetching sequence names...")
      const sequences = await tx.execute(
        sql`SELECT sequencename FROM pg_sequences WHERE schemaname = 'public';`
      )
      console.log(`Found ${sequences.rows.length} sequences.`)
      for (const sequence of sequences.rows) {
        console.log(`Dropping sequence: ${sequence.sequencename}...`)
        await tx.execute(
          sql.raw(`DROP SEQUENCE IF EXISTS "public"."${sequence.sequencename}" CASCADE;`)
        )
        console.log(`Sequence dropped: ${sequence.sequencename}`)
      }
      console.log("All sequences dropped.")

      // Drop functions
      console.log("Fetching function names...")
      const functions = await tx.execute(
        sql`SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid from pg_namespace WHERE nspname = 'public');`
      )
      console.log(`Found ${functions.rows.length} functions.`)
      for (const func of functions.rows) {
        console.log(`Dropping function: ${func.proname}...`)
        await tx.execute(sql.raw(`DROP FUNCTION IF EXISTS "public"."${func.proname}" CASCADE;`))
        console.log(`Function dropped: ${func.proname}`)
      }
      console.log("All functions dropped.")

      // Drop views
      console.log("Fetching view names...")
      const views = await tx.execute(sql`SELECT viewname FROM pg_views WHERE schemaname = 'public'`)
      console.log(`Found ${views.rows.length} views.`)
      for (const view of views.rows) {
        console.log(`Dropping view: ${view.viewname}...`)
        await tx.execute(sql.raw(`DROP VIEW IF EXISTS "public"."${view.viewname}" CASCADE;`))
        console.log(`View dropped: ${view.viewname}`)
      }
      console.log("All views dropped.")

      console.log("Re-enabling triggers...")
      await tx.execute(sql`SET session_replication_role = 'origin';`)
      console.log("Triggers re-enabled.")
    })

    console.log("Database successfully reset.")
  } catch (error) {
    console.error("Error resetting database:", error)
    process.exit(1)
  }
}

resetDb()
