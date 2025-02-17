import { integer, pgTable, uuid, text, pgEnum, timestamp, boolean, primaryKey, jsonb } from "drizzle-orm/pg-core"
import { uuidv7 } from "uuidv7"

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

// Tables
export const organisations = pgTable("organisations", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  ...timestamps
})

export const users = pgTable("users", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text(),
  resetPasswordToken: text(),
  resetPasswordExpiresAt: timestamp({ withTimezone: true }),
  ...organisationId,
  ...timestamps
})

export const sessions = pgTable(
  "sessions",
  {
    token: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    ...timestamps
  },
  (t) => [primaryKey({ columns: [t.token, t.userId] })]
)

export const components = pgTable("components", {
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
})

export const componentFields = pgTable(
  "component_fields",
  {
    componentId: uuid()
      .notNull()
      .references(() => components.id),
    fieldKey: text().notNull(), // the key used in the component's schema object
    type: fieldTypeEnum().notNull(),
    required: boolean().notNull().default(false),
    description: text(),
    displayName: text(),
    defaultValue: text(),
    minValue: integer(),
    maxValue: integer(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId
  },
  (t) => [primaryKey({ columns: [t.componentId, t.fieldKey] })]
)

export const fieldOptions = pgTable("field_options", {
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
})

export const stories = pgTable("stories", {
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
})

export const sites = pgTable("sites", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  ...organisationId,
  ...timestamps
})
