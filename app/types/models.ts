import type { users } from "~~/server/database/schema"

export type DUser = typeof users.$inferSelect
