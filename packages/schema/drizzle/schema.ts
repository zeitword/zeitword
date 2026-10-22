import {
  integer,
  snakeCase,
  uuid,
  text,
  pgEnum,
  timestamp,
  boolean,
  primaryKey,
  jsonb,
  uniqueIndex,
  unique
} from "drizzle-orm/pg-core"
import { uuidv7 } from "uuidv7"

import { organisations } from "../../../server/database/schema"
export {
  organisations,
  organisationMembers,
  users,
  sessions,
  accounts,
  verifications,
  authRateLimits,
  userInvitations
} from "../../../server/database/schema"

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true })
}

// Create an enum type for the allowed field types (as listed in our CMS zod schema)
export const fieldTypeEnum = pgEnum("field_type", [
  "blocks",
  "text",
  "textarea",
  "richtext",
  "markdown",
  "number",
  "datetime",
  "boolean",
  "option",
  "options",
  "asset",
  "assets",
  "link",
  "section",
  "custom"
])

const organisationId = {
  organisationId: uuid()
    .notNull()
    .references(() => organisations.id)
}

export const components = snakeCase.table(
  "components",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    name: text().notNull(),
    displayName: text().notNull(),
    previewImage: text(),
    previewField: text(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId,
    ...timestamps
  },
  (t) => [unique().on(t.siteId, t.name)]
)

export const componentFields = snakeCase.table(
  "component_fields",
  {
    componentId: uuid()
      .notNull()
      .references(() => components.id),
    fieldKey: text().notNull(), // the key used in the component's schema object
    order: text().notNull(),
    type: fieldTypeEnum().notNull(),
    required: boolean().notNull().default(false),
    description: text(),
    displayName: text(),
    defaultValue: text(),
    minValue: integer(),
    maxValue: integer(),
    componentWhitelist: jsonb(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId
  },
  (t) => [primaryKey({ columns: [t.componentId, t.fieldKey] })]
)

export const fieldOptions = snakeCase.table(
  "field_options",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    componentId: uuid()
      .notNull()
      .references(() => components.id),
    fieldKey: text().notNull(), // which field this option belongs to.
    optionName: text().notNull(),
    optionValue: text().notNull(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId
  },
  (t) => [unique().on(t.componentId, t.fieldKey, t.optionValue)]
)

export const stories = snakeCase.table(
  "stories",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    slug: text().notNull(),
    title: text().notNull(),
    content: jsonb().notNull(),
    componentId: uuid()
      .notNull()
      .references(() => components.id),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId,
    ...timestamps
  },
  (t) => [uniqueIndex("slug_idx").on(t.slug, t.siteId)]
)

export const sites = snakeCase.table("sites", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  domain: text().notNull().default(""),
  ...organisationId,
  ...timestamps
})

export const waitlist = snakeCase.table("waitlist", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  email: text().notNull().unique(),
  confirmed: boolean().notNull().default(false),
  confirmationToken: text().notNull().unique(),
  ...timestamps
})
