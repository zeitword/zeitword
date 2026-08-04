import { drizzle } from "drizzle-orm/node-postgres"

import { relations } from "../database/relations"
import * as schema from "../database/schema"
export { sql, eq, and, or, isNull } from "drizzle-orm"

export const tables = schema

const database = drizzle(process.env.NUXT_DSN!, {
  relations
})

export function useDrizzle() {
  return database
}

export const db = database
