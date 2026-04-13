import {
  integer,
  pgTable,
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

export const storyTypeEnum = pgEnum("story_type", ["story", "folder"])

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

export const userInvitations = pgTable("user_invitations", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  email: text().notNull().unique(),
  token: text().notNull().unique(),
  invitedBy: uuid()
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  acceptedAt: timestamp({ withTimezone: true }),
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

export const components = pgTable(
  "components",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    name: text().notNull(),
    displayName: text().notNull(),
    previewImage: text(),
    previewField: text(),
    renderPreview: boolean().notNull().default(false),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId,
    ...timestamps
  },
  (t) => [unique().on(t.siteId, t.name)]
)

export const componentFields = pgTable(
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
    config: jsonb(),
    componentWhitelist: jsonb(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId
  },
  (t) => [primaryKey({ columns: [t.componentId, t.fieldKey] })]
)

export const fieldOptions = pgTable(
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

export const stories = pgTable(
  "stories",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    type: storyTypeEnum().notNull().default("story"),
    slug: text().notNull(),
    title: text().notNull(),
    content: jsonb().notNull(),
    componentId: uuid().references(() => components.id),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId,
    ...timestamps
  },
  (t) => [uniqueIndex("slug_idx").on(t.slug, t.siteId)]
)

export const sites = pgTable("sites", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  domain: text().notNull().default(""),
  defaultLanguage: text()
    .references(() => languages.code)
    .notNull()
    .default("en"),
  ...organisationId,
  ...timestamps
})

export const siteApiKeys = pgTable("site_api_keys", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  hash: text().notNull().unique(),
  siteId: uuid()
    .notNull()
    .references(() => sites.id),
  ...organisationId,
  ...timestamps
})

export const personalAccessTokens = pgTable("personal_access_tokens", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  hash: text().notNull().unique(),
  lastFourChars: text().notNull(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  ...organisationId,
  expiresAt: timestamp({ withTimezone: true }),
  lastUsedAt: timestamp({ withTimezone: true }),
  ...timestamps
})

export const languages = pgTable("languages", {
  code: text().primaryKey(),
  name: text().notNull(),
  nativeName: text().notNull(),
  ...timestamps
})

export const siteLanguages = pgTable(
  "site_languages",
  {
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    languageCode: text()
      .notNull()
      .references(() => languages.code),
    ...timestamps
  },
  (t) => [primaryKey({ columns: [t.siteId, t.languageCode] })]
)

export const waitlist = pgTable("waitlist", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  email: text().notNull().unique(),
  confirmed: boolean().notNull().default(false),
  confirmationToken: text().notNull().unique(),
  ...timestamps
})

export const assets = pgTable("assets", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  fileName: text().notNull(),
  contentType: text().notNull(),
  fileSize: integer().notNull(),
  type: text().notNull(),
  src: text().notNull(),
  siteId: uuid()
    .notNull()
    .references(() => sites.id),
  uploadedBy: uuid().references(() => users.id),
  ...organisationId,
  ...timestamps
})

export const storyTranslatedSlugs = pgTable(
  "story_translated_slugs",
  {
    storyId: uuid()
      .notNull()
      .references(() => stories.id),
    languageCode: text()
      .notNull()
      .references(() => languages.code),
    slug: text().notNull(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    ...organisationId,
    ...timestamps
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.languageCode] }),
    uniqueIndex("translated_slug_site_lang_idx").on(t.slug, t.siteId, t.languageCode)
  ]
)
