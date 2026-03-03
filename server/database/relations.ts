import { defineRelations } from "drizzle-orm"

import * as schema from "./schema"

export const relations = defineRelations(schema, (r) => ({
  componentFields: {
    component: r.one.components({
      from: r.componentFields.componentId,
      to: r.components.id
    }),
    site: r.one.sites({
      from: r.componentFields.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.componentFields.organisationId,
      to: r.organisations.id
    })
  },

  components: {
    fields: r.many.componentFields({
      from: r.components.id,
      to: r.componentFields.componentId
    }),
    site: r.one.sites({
      from: r.components.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.components.organisationId,
      to: r.organisations.id
    }),
    fieldOptions: r.many.fieldOptions({
      from: r.components.id,
      to: r.fieldOptions.componentId
    }),
    stories: r.many.stories({
      from: r.components.id,
      to: r.stories.componentId
    })
  },

  sites: {
    componentFields: r.many.componentFields({
      from: r.sites.id,
      to: r.componentFields.siteId
    }),
    components: r.many.components({
      from: r.sites.id,
      to: r.components.siteId
    }),
    fieldOptions: r.many.fieldOptions({
      from: r.sites.id,
      to: r.fieldOptions.siteId
    }),
    languages: r.many.siteLanguages({
      from: r.sites.id,
      to: r.siteLanguages.siteId
    }),
    apiKeys: r.many.siteApiKeys({
      from: r.sites.id,
      to: r.siteApiKeys.siteId
    }),
    defaultLang: r.one.languages({
      from: r.sites.defaultLanguage,
      to: r.languages.code
    }),
    organisation: r.one.organisations({
      from: r.sites.organisationId,
      to: r.organisations.id
    }),
    stories: r.many.stories({
      from: r.sites.id,
      to: r.stories.siteId
    }),
    storyTranslatedSlugs: r.many.storyTranslatedSlugs({
      from: r.sites.id,
      to: r.storyTranslatedSlugs.siteId
    })
  },

  storyTranslatedSlugs: {
    story: r.one.stories({
      from: r.storyTranslatedSlugs.storyId,
      to: r.stories.id
    }),
    language: r.one.languages({
      from: r.storyTranslatedSlugs.languageCode,
      to: r.languages.code
    }),
    site: r.one.sites({
      from: r.storyTranslatedSlugs.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.storyTranslatedSlugs.organisationId,
      to: r.organisations.id
    })
  },

  siteApiKeys: {
    site: r.one.sites({
      from: r.siteApiKeys.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.siteApiKeys.organisationId,
      to: r.organisations.id
    })
  },

  languages: {
    sites: r.many.siteLanguages({
      from: r.languages.code,
      to: r.siteLanguages.languageCode
    }),
    storyTranslatedSlugs: r.many.storyTranslatedSlugs({
      from: r.languages.code,
      to: r.storyTranslatedSlugs.languageCode
    })
  },

  siteLanguages: {
    site: r.one.sites({
      from: r.siteLanguages.siteId,
      to: r.sites.id
    }),
    language: r.one.languages({
      from: r.siteLanguages.languageCode,
      to: r.languages.code
    })
  },

  organisations: {
    fields: r.many.componentFields({
      from: r.organisations.id,
      to: r.componentFields.organisationId
    }),
    components: r.many.components({
      from: r.organisations.id,
      to: r.components.organisationId
    }),
    fieldOptions: r.many.fieldOptions({
      from: r.organisations.id,
      to: r.fieldOptions.organisationId
    }),
    sites: r.many.sites({
      from: r.organisations.id,
      to: r.sites.organisationId
    }),
    stories: r.many.stories({
      from: r.organisations.id,
      to: r.stories.organisationId
    }),
    users: r.many.users({
      from: r.organisations.id,
      to: r.users.organisationId
    }),
    storyTranslatedSlugs: r.many.storyTranslatedSlugs({
      from: r.organisations.id,
      to: r.storyTranslatedSlugs.organisationId
    }),
    userInvitations: r.many.userInvitations({
      from: r.organisations.id,
      to: r.userInvitations.organisationId
    })
  },

  fieldOptions: {
    component: r.one.components({
      from: r.fieldOptions.componentId,
      to: r.components.id
    }),
    site: r.one.sites({
      from: r.fieldOptions.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.fieldOptions.organisationId,
      to: r.organisations.id
    })
  },

  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id
    })
  },

  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId
    }),
    organisation: r.one.organisations({
      from: r.users.organisationId,
      to: r.organisations.id
    }),
    invitationsSent: r.many.userInvitations({
      from: r.users.id,
      to: r.userInvitations.invitedBy
    })
  },

  userInvitations: {
    invitedByUser: r.one.users({
      from: r.userInvitations.invitedBy,
      to: r.users.id
    }),
    organisation: r.one.organisations({
      from: r.userInvitations.organisationId,
      to: r.organisations.id
    })
  },

  stories: {
    component: r.one.components({
      from: r.stories.componentId,
      to: r.components.id
    }),
    site: r.one.sites({
      from: r.stories.siteId,
      to: r.sites.id
    }),
    organisation: r.one.organisations({
      from: r.stories.organisationId,
      to: r.organisations.id
    }),
    translatedSlugs: r.many.storyTranslatedSlugs({
      from: r.stories.id,
      to: r.storyTranslatedSlugs.storyId
    })
  }
}))
