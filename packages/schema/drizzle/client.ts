import { drizzle } from "drizzle-orm/node-postgres"

import { relations } from "./relations"

const database = drizzle(process.env.DSN!, {
  relations
})

export function useDrizzle() {
  return database
}
