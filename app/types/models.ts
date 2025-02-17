import type {
  componentFields,
  sites,
  stories,
  users
} from "~~/server/database/schema"

export type DUser = typeof users.$inferSelect

export type DSite = typeof sites.$inferSelect

export type DStory = typeof stories.$inferSelect

export type DField = typeof componentFields.$inferSelect
