import { isNull, sql } from "drizzle-orm"
import {
  integer,
  bigint,
  index,
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
export const organisations = snakeCase.table("organisations", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  ...timestamps
})

export const users = snakeCase.table(
  "users",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    authVersion: integer().notNull().default(0),
    image: text(),
    ...timestamps
  },
  (t) => [uniqueIndex("users_email_normalized_unique").on(sql`lower(${t.email})`)]
)

export const organisationMembers = snakeCase.table(
  "organisation_members",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    ...organisationId,
    role: text({ enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    authVersion: integer().notNull().default(0),
    ...timestamps
  },
  (t) => [unique("organisation_members_user_org_unique").on(t.userId, t.organisationId)]
)

export const userInvitations = snakeCase.table(
  "user_invitations",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    email: text().notNull(),
    token: text().notNull().unique(),
    invitedBy: uuid()
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    ...organisationId,
    ...timestamps
  },
  (t) => [unique("user_invitations_org_email_unique").on(t.organisationId, t.email)]
)

export const sessions = snakeCase.table(
  "auth_sessions",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    token: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    authVersion: integer().notNull().default(0),
    organisationId: uuid().references(() => organisations.id),
    membershipVersion: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)]
)

export const accounts = snakeCase.table(
  "auth_accounts",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    password: text(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("auth_accounts_provider_account_unique").on(t.providerId, t.accountId),
    index("auth_accounts_user_idx").on(t.userId)
  ]
)

export const verifications = snakeCase.table(
  "auth_verifications",
  {
    id: uuid().primaryKey().$defaultFn(uuidv7),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)]
)

export const authRateLimits = snakeCase.table("auth_rate_limits", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull()
})

export const components = snakeCase.table(
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
    config: jsonb(),
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
  (t) => [uniqueIndex("slug_idx").on(t.slug, t.siteId).where(isNull(t.deletedAt))]
)

export const sites = snakeCase.table("sites", {
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

export const siteApiKeys = snakeCase.table("site_api_keys", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  hash: text().notNull().unique(),
  siteId: uuid()
    .notNull()
    .references(() => sites.id),
  ...organisationId,
  ...timestamps
})

export const personalAccessTokens = snakeCase.table("personal_access_tokens", {
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

export const languages = snakeCase.table("languages", {
  code: text().primaryKey(),
  name: text().notNull(),
  nativeName: text().notNull(),
  ...timestamps
})

export const siteLanguages = snakeCase.table(
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

export const waitlist = snakeCase.table("waitlist", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  email: text().notNull().unique(),
  confirmed: boolean().notNull().default(false),
  confirmationToken: text().notNull().unique(),
  ...timestamps
})

export const assets = snakeCase.table("assets", {
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

// AI

export const languageModelUsageCredits = snakeCase.table("language_model_usage_credits", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  amount: integer().notNull(),
  ...organisationId,
  ...timestamps
})

export const languageModelUsages = snakeCase.table("language_model_usages", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  modelId: text().notNull(),
  inputTokens: integer().notNull(),
  outputTokens: integer().notNull(),
  totalTokens: integer().notNull(),
  ...organisationId,
  ...timestamps
})

export const storyTranslatedSlugs = snakeCase.table(
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
