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

export const sites = pgTable("sites", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  name: text().notNull(),
  domain: text().notNull().default(""),
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
  organisation: one(organisations, {
    fields: [sites.organisationId],
    references: [organisations.id]
  }),
  stories: many(stories)
}))

export const organisationsRelations = relations(organisations, ({ many }) => ({
  fields: many(componentFields),
  components: many(components),
  fieldOptions: many(fieldOptions),
  sites: many(sites),
  stories: many(stories),
  users: many(users),
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

export const storiesRelations = relations(stories, ({ one }) => ({
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
  })
}))

export const waitlist = pgTable("waitlist", {
  id: uuid().primaryKey().$defaultFn(uuidv7),
  email: text().notNull().unique(),
  confirmed: boolean().notNull().default(false),
  confirmationToken: text().notNull().unique(),
  ...timestamps
})
