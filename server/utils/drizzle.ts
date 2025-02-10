import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../database/schema"
export { sql, eq, and, or } from "drizzle-orm"

export const tables = schema

const database = drizzle(process.env.NUXT_DSN!, { schema, casing: "snake_case" })

export function useDrizzle() {
  return database
}
