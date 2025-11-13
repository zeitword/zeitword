import { relations } from "drizzle-orm"
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

// AI

export const languageModelUsageCredits = pgTable("language_model_usage_credits", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  amount: integer().notNull(),
  ...organisationId,
  ...timestamps
})

export const languageModelUsages = pgTable("language_model_usages", {
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

// RELATIONS

export const componentFieldsRelations = relations(componentFields, ({ one }) => ({
  component: one(components, {
    fields: [componentFields.componentId],
    references: [components.id]
  }),
  site: one(sites, {
    fields: [componentFields.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [componentFields.organisationId],
    references: [organisations.id]
  })
}))

export const componentsRelations = relations(components, ({ one, many }) => ({
  fields: many(componentFields),
  site: one(sites, {
    fields: [components.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [components.organisationId],
    references: [organisations.id]
  }),
  fieldOptions: many(fieldOptions),
  stories: many(stories)
}))

export const sitesRelations = relations(sites, ({ one, many }) => ({
  componentFields: many(componentFields),
  components: many(components),
  fieldOptions: many(fieldOptions),
  languages: many(siteLanguages),
  apiKeys: many(siteApiKeys),
  defaultLang: one(languages, {
    fields: [sites.defaultLanguage],
    references: [languages.code]
  }),
  organisation: one(organisations, {
    fields: [sites.organisationId],
    references: [organisations.id]
  }),
  stories: many(stories),
  storyTranslatedSlugs: many(storyTranslatedSlugs)
}))

export const storyTranslatedSlugsRelations = relations(storyTranslatedSlugs, ({ one }) => ({
  story: one(stories, {
    fields: [storyTranslatedSlugs.storyId],
    references: [stories.id]
  }),
  language: one(languages, {
    fields: [storyTranslatedSlugs.languageCode],
    references: [languages.code]
  }),
  site: one(sites, {
    fields: [storyTranslatedSlugs.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [storyTranslatedSlugs.organisationId],
    references: [organisations.id]
  })
}))

export const siteApiKeysRelations = relations(siteApiKeys, ({ one }) => ({
  site: one(sites, {
    fields: [siteApiKeys.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [siteApiKeys.organisationId],
    references: [organisations.id]
  })
}))

export const languagesRelations = relations(languages, ({ many }) => ({
  sites: many(siteLanguages),
  storyTranslatedSlugs: many(storyTranslatedSlugs)
}))

export const siteLanguagesRelations = relations(siteLanguages, ({ one }) => ({
  site: one(sites, {
    fields: [siteLanguages.siteId],
    references: [sites.id]
  }),
  language: one(languages, {
    fields: [siteLanguages.languageCode],
    references: [languages.code]
  })
}))

export const organisationsRelations = relations(organisations, ({ many }) => ({
  fields: many(componentFields),
  components: many(components),
  fieldOptions: many(fieldOptions),
  sites: many(sites),
  stories: many(stories),
  users: many(users),
  storyTranslatedSlugs: many(storyTranslatedSlugs),
  userInvitations: many(userInvitations)
}))

export const fieldOptionsRelations = relations(fieldOptions, ({ one }) => ({
  component: one(components, {
    fields: [fieldOptions.componentId],
    references: [components.id]
  }),
  site: one(sites, {
    fields: [fieldOptions.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [fieldOptions.organisationId],
    references: [organisations.id]
  })
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id]
  }),
  invitationsSent: many(userInvitations)
}))

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  invitedByUser: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id]
  }),
  organisation: one(organisations, {
    fields: [userInvitations.organisationId],
    references: [organisations.id]
  })
}))

export const storiesRelations = relations(stories, ({ one, many }) => ({
  component: one(components, {
    fields: [stories.componentId],
    references: [components.id]
  }),
  site: one(sites, {
    fields: [stories.siteId],
    references: [sites.id]
  }),
  organisation: one(organisations, {
    fields: [stories.organisationId],
    references: [organisations.id]
  }),
  translatedSlugs: many(storyTranslatedSlugs)
}))
