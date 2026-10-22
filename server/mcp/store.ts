import { and, eq, isNull, sql, getTableColumns, inArray, ilike, or } from "drizzle-orm"
import { createHash } from "node:crypto"

import type { AuthDatabase } from "../auth"

import {
  users,
  sites,
  organisations,
  organisationMembers,
  stories,
  components,
  componentFields,
  fieldOptions,
  siteLanguages,
  languages,
  assets
} from "../database/schema"
import {
  applyContentPatch,
  enrichBlocks,
  object,
  validateContent,
  type PatchOperation,
  type ComponentSchema,
  type ContentIssue
} from "./content"

export class ContentError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
export const storyColumns = {
  ...getTableColumns(stories),
  versionTimestamp: sql<string>`${stories.updatedAt}::text`
}
export function revision(story: Record<string, unknown>) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        story.versionTimestamp,
        story.componentId,
        story.content,
        story.title,
        story.slug,
        story.deletedAt
      ])
    )
    .digest("hex")
}
export class ContentStore {
  constructor(
    private database: AuthDatabase,
    private userId: string,
    private baseURL: string
  ) {}

  async createSite(input: {
    workspaceId: string
    id: string
    name: string
    domain?: string
    defaultLanguage: string
  }) {
    return this.database.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: organisations.id })
        .from(organisations)
        .innerJoin(organisationMembers, eq(organisationMembers.organisationId, organisations.id))
        .innerJoin(users, eq(users.id, organisationMembers.userId))
        .where(
          and(
            eq(organisations.id, input.workspaceId),
            eq(users.id, this.userId),
            isNull(organisations.deletedAt),
            isNull(organisationMembers.deletedAt),
            isNull(users.deletedAt)
          )
        )
        .for("share")
      if (!workspace) throw new ContentError("NOT_FOUND", "Workspace not found or access revoked")
      const [language] = await tx
        .select({ code: languages.code })
        .from(languages)
        .where(and(eq(languages.code, input.defaultLanguage), isNull(languages.deletedAt)))
      if (!language) throw new ContentError("VALIDATION", "Unknown default language")
      const [site] = await tx
        .insert(sites)
        .values({
          id: input.id,
          name: input.name,
          domain: input.domain ?? "",
          defaultLanguage: language.code,
          organisationId: workspace.id
        })
        .returning()
      await tx.insert(siteLanguages).values({ siteId: site.id, languageCode: language.code })
      return {
        id: site.id,
        name: site.name,
        domain: site.domain,
        workspaceId: site.organisationId,
        defaultLanguage: site.defaultLanguage
      }
    })
  }

  async inSite<T>(
    siteId: string,
    run: (tx: AuthDatabase, site: typeof sites.$inferSelect) => Promise<T>
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      // Hold these rows through the operation: archiving the membership, account,
      // workspace or site cannot race a write which has already been authorized.
      const [row] = await tx
        .select({ site: sites })
        .from(sites)
        .innerJoin(organisations, eq(organisations.id, sites.organisationId))
        .innerJoin(
          organisationMembers,
          and(
            eq(organisationMembers.organisationId, sites.organisationId),
            eq(organisationMembers.userId, this.userId)
          )
        )
        .innerJoin(users, eq(users.id, organisationMembers.userId))
        .where(
          and(
            eq(sites.id, siteId),
            isNull(sites.deletedAt),
            isNull(organisations.deletedAt),
            isNull(organisationMembers.deletedAt),
            isNull(users.deletedAt)
          )
        )
        .for("share")
      if (!row) throw new ContentError("NOT_FOUND", "Site not found or access revoked")
      return run(tx, row.site)
    })
  }
  storyWhere(site: typeof sites.$inferSelect, storyId: string) {
    return and(
      eq(stories.id, storyId),
      eq(stories.siteId, site.id),
      eq(stories.organisationId, site.organisationId),
      isNull(stories.deletedAt)
    )
  }
  async story(tx: AuthDatabase, site: typeof sites.$inferSelect, storyId: string, lock = false) {
    const query = tx.select(storyColumns).from(stories).where(this.storyWhere(site, storyId))
    const [story] = await (lock ? query.for("update") : query)
    if (!story) throw new ContentError("NOT_FOUND", "Story not found in this site")
    return story
  }
  expectRevision(story: Record<string, unknown>, expected: string) {
    if (revision(story) !== expected)
      throw new ContentError("CONFLICT", "Story changed. Read it again and reconcile your edits.", {
        currentRevision: revision(story)
      })
  }
  view(story: typeof stories.$inferSelect & { versionTimestamp: string }) {
    const { versionTimestamp: _versionTimestamp, ...data } = story
    return {
      ...data,
      revision: revision(story),
      editorUrl: `${this.baseURL}/sites/${story.siteId}/stories/story/${story.id}`
    }
  }
  async schemas(tx: AuthDatabase, site: typeof sites.$inferSelect) {
    const [schemas, fields, options] = await Promise.all([
      tx
        .select()
        .from(components)
        .where(
          and(
            eq(components.siteId, site.id),
            eq(components.organisationId, site.organisationId),
            isNull(components.deletedAt)
          )
        ),
      tx
        .select()
        .from(componentFields)
        .where(
          and(
            eq(componentFields.siteId, site.id),
            eq(componentFields.organisationId, site.organisationId)
          )
        )
        .orderBy(componentFields.order),
      tx
        .select()
        .from(fieldOptions)
        .where(
          and(
            eq(fieldOptions.siteId, site.id),
            eq(fieldOptions.organisationId, site.organisationId)
          )
        )
    ])
    return schemas.map((schema) => ({
      ...schema,
      fields: fields
        .filter((f) => f.componentId === schema.id)
        .map((field) => ({
          ...field,
          options: options.filter(
            (o) => o.componentId === schema.id && o.fieldKey === field.fieldKey
          )
        }))
    }))
  }
  async enabledLanguages(tx: AuthDatabase, site: typeof sites.$inferSelect) {
    return tx
      .select({ code: languages.code, name: languages.name, nativeName: languages.nativeName })
      .from(siteLanguages)
      .innerJoin(languages, eq(languages.code, siteLanguages.languageCode))
      .where(and(eq(siteLanguages.siteId, site.id), isNull(siteLanguages.deletedAt)))
  }
  async language(tx: AuthDatabase, site: typeof sites.$inferSelect, language: string) {
    if (!(await this.enabledLanguages(tx, site)).some((l) => l.code === language))
      throw new ContentError("VALIDATION", "Language is not enabled for this site")
  }
  async issues(
    tx: AuthDatabase,
    site: typeof sites.$inferSelect,
    content: unknown,
    componentId: string,
    schemas: ComponentSchema[]
  ): Promise<ContentIssue[]> {
    const issues = validateContent(content, componentId, schemas)
    if (issues.length) return issues
    const refs: { kind: "story" | "asset"; id: string; path: (string | number)[] }[] = []
    function visit(value: any, id: string, path: (string | number)[], depth: number) {
      if (!object(value) || depth > 32) return
      for (const field of schemas.find((s) => s.id === id)?.fields ?? []) {
        const item = value[field.fieldKey],
          p = [...path, field.fieldKey]
        if (field.type === "link" && item?.type === "internal")
          refs.push({ kind: "story", id: item.storyId, path: p })
        if (field.type === "asset" && item?.id) refs.push({ kind: "asset", id: item.id, path: p })
        if (field.type === "assets" && Array.isArray(item))
          item.forEach((a, i) => {
            if (a?.id) refs.push({ kind: "asset", id: a.id, path: [...p, i] })
          })
        if (field.type === "blocks" && Array.isArray(item))
          item.forEach((b, i) => visit(b.content, b.componentId, [...p, i, "content"], depth + 1))
      }
    }
    visit(content, componentId, [], 0)
    const validId = (value: unknown): value is string =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    const storyIds = refs.filter((r) => r.kind === "story" && validId(r.id)).map((r) => r.id)
    const assetIds = refs.filter((r) => r.kind === "asset" && validId(r.id)).map((r) => r.id)
    const foundStories = storyIds.length
      ? await tx
          .select({ id: stories.id })
          .from(stories)
          .where(
            and(
              inArray(stories.id, storyIds),
              eq(stories.siteId, site.id),
              eq(stories.organisationId, site.organisationId),
              isNull(stories.deletedAt)
            )
          )
      : []
    const foundAssets = assetIds.length
      ? await tx
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              inArray(assets.id, assetIds),
              eq(assets.siteId, site.id),
              eq(assets.organisationId, site.organisationId),
              isNull(assets.deletedAt)
            )
          )
      : []
    const known = {
      story: new Set(foundStories.map((r) => r.id)),
      asset: new Set(foundAssets.map((r) => r.id))
    }
    return refs
      .filter((r) => !known[r.kind].has(r.id))
      .map((r) => ({
        path: r.path,
        code: "reference",
        message: `Referenced ${r.kind} does not exist in this site`
      }))
  }
  async validated(
    tx: AuthDatabase,
    site: typeof sites.$inferSelect,
    content: Record<string, unknown>,
    componentId: string
  ) {
    const schemas = await this.schemas(tx, site)
    const issues = await this.issues(tx, site, content, componentId, schemas)
    if (issues.length)
      throw new ContentError("VALIDATION", "Content does not match its component schema", {
        issues
      })
    enrichBlocks(content, componentId, schemas)
    return content
  }
  getStory(siteId: string, storyId: string) {
    return this.inSite(siteId, async (tx, site) => this.view(await this.story(tx, site, storyId)))
  }
  listComponents(siteId: string) {
    return this.inSite(siteId, (tx, site) => this.schemas(tx, site))
  }
  listLanguages(siteId: string) {
    return this.inSite(siteId, (tx, site) => this.enabledLanguages(tx, site))
  }
  patch(
    siteId: string,
    storyId: string,
    input: {
      language: string
      expectedRevision: string
      operations: PatchOperation[]
      dryRun: boolean
    }
  ) {
    return this.inSite(siteId, async (tx, site) => {
      const story = await this.story(tx, site, storyId, true)
      this.expectRevision(story, input.expectedRevision)
      await this.language(tx, site, input.language)
      if (!story.componentId)
        throw new ContentError("VALIDATION", "Assign a component before editing content")
      if (!object(story.content))
        throw new ContentError("VALIDATION", "Story content must be a locale object")
      let content: Record<string, unknown>
      try {
        content = applyContentPatch(story.content[input.language] ?? {}, input.operations)
      } catch (error) {
        throw new ContentError(
          "VALIDATION",
          error instanceof Error ? error.message : "Invalid patch"
        )
      }
      await this.validated(tx, site, content, story.componentId)
      let updated = story
      if (!input.dryRun) {
        const [saved] = await tx
          .update(stories)
          .set({ content: { ...story.content, [input.language]: content }, updatedAt: new Date() })
          .where(this.storyWhere(site, storyId))
          .returning(storyColumns)
        if (!saved) throw new ContentError("CONFLICT", "Story is no longer available")
        updated = saved
      }
      return {
        storyId,
        language: input.language,
        revision: revision(updated!),
        dryRun: input.dryRun,
        content,
        changedPaths: input.operations.map((o) => o.path),
        editorUrl: this.view(updated!).editorUrl
      }
    })
  }
  validate(siteId: string, storyId: string, language: string, content?: Record<string, unknown>) {
    return this.inSite(siteId, async (tx, site) => {
      const story = await this.story(tx, site, storyId)
      await this.language(tx, site, language)
      if (!story.componentId) throw new ContentError("VALIDATION", "Story has no component")
      const issues = await this.issues(
        tx,
        site,
        content ?? (object(story.content) ? story.content[language] : undefined),
        story.componentId,
        await this.schemas(tx, site)
      )
      return { storyId, language, valid: issues.length === 0, issues }
    })
  }
  create(
    siteId: string,
    input: {
      id: string
      title: string
      slug: string
      componentId: string
      content: Record<string, Record<string, unknown>>
    }
  ) {
    return this.inSite(siteId, async (tx, site) => {
      for (const [language, content] of Object.entries(input.content)) {
        await this.language(tx, site, language)
        await this.validated(tx, site, content, input.componentId)
      }
      if (!(await this.schemas(tx, site)).some((s) => s.id === input.componentId))
        throw new ContentError("VALIDATION", "Component does not exist in this site")
      const [story] = await tx
        .insert(stories)
        .values({ ...input, siteId, organisationId: site.organisationId, type: "story" })
        .returning(storyColumns)
      return this.view(story!)
    })
  }
  update(
    siteId: string,
    storyId: string,
    expectedRevision: string,
    input: { title?: string; slug?: string }
  ) {
    return this.inSite(siteId, async (tx, site) => {
      const story = await this.story(tx, site, storyId, true)
      this.expectRevision(story, expectedRevision)
      const [updated] = await tx
        .update(stories)
        .set({ ...input, updatedAt: new Date() })
        .where(this.storyWhere(site, storyId))
        .returning(storyColumns)
      return this.view(updated!)
    })
  }
  delete(siteId: string, storyId: string, expectedRevision: string) {
    return this.inSite(siteId, async (tx, site) => {
      const story = await this.story(tx, site, storyId, true)
      this.expectRevision(story, expectedRevision)
      if (story.type === "folder")
        throw new ContentError("VALIDATION", "This tool deletes stories, not folders")
      await tx
        .update(stories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(this.storyWhere(site, storyId))
      return { storyId, deleted: true }
    })
  }
  search(
    siteId: string,
    input: { query?: string; componentId?: string; offset: number; limit: number }
  ) {
    return this.inSite(siteId, async (tx, site) => {
      const pattern = input.query ? `%${input.query.replace(/[\\%_]/g, "\\$&")}%` : undefined
      const where = and(
        eq(stories.siteId, site.id),
        eq(stories.organisationId, site.organisationId),
        isNull(stories.deletedAt),
        input.componentId ? eq(stories.componentId, input.componentId) : undefined,
        pattern
          ? or(
              ilike(stories.title, pattern),
              ilike(stories.slug, pattern),
              sql`${stories.content}::text ilike ${pattern}`
            )
          : undefined
      )
      const data = await tx
        .select({
          id: stories.id,
          title: stories.title,
          slug: stories.slug,
          componentId: stories.componentId,
          type: stories.type
        })
        .from(stories)
        .where(where)
        .orderBy(stories.id)
        .offset(input.offset)
        .limit(input.limit)
      const [count] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(stories)
        .where(where)
      return { data, pagination: { total: count!.total, offset: input.offset, limit: input.limit } }
    })
  }
  asset(siteId: string, assetId: string, fileName?: string) {
    return this.inSite(siteId, async (tx, site) => {
      const where = and(
        eq(assets.id, assetId),
        eq(assets.siteId, site.id),
        eq(assets.organisationId, site.organisationId),
        isNull(assets.deletedAt)
      )
      const [asset] =
        fileName === undefined
          ? await tx.select().from(assets).where(where)
          : await tx
              .update(assets)
              .set({ fileName, updatedAt: new Date() })
              .where(where)
              .returning()
      if (!asset) throw new ContentError("NOT_FOUND", "Asset not found in this site")
      return asset
    })
  }
  listAssets(siteId: string, offset: number, limit: number) {
    return this.inSite(siteId, (tx, site) =>
      tx
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.siteId, site.id),
            eq(assets.organisationId, site.organisationId),
            isNull(assets.deletedAt)
          )
        )
        .orderBy(assets.id)
        .offset(offset)
        .limit(limit)
    )
  }
}
