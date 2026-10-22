import { drizzle } from "drizzle-orm/node-postgres"

import { createAuth } from "../server/auth"
import { relations } from "../server/database/relations"

// Schema generation only; no database connection is opened.
export const auth = createAuth(drizzle("postgresql://localhost/zeitword", { relations }), {
  secret: "schema-generation-only-not-a-runtime-secret",
  baseURL: "http://localhost:3000"
})
