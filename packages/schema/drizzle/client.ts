import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../schema"

const database = drizzle(process.env.DSN!, {
  schema,
  casing: "snake_case"
})

export function useDrizzle() {
  return database
}
