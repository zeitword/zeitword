import { and, eq, inArray } from "drizzle-orm"
import { componentFields, components, fieldOptions, sites } from "~~/server/database/schema"
import {
  buildValidationSchemaForComponent,
  buildValidationSchemaForField,
  createComponentResolver,
  isEmptyValue,
  validateStoryContent as validateStoryContentWithResolver,
  type ComponentDefinition,
  type ComponentResolver,
  type FieldDefinition
} from "~~/shared/field-schema"

export type ComponentData = Record<string, unknown>

export {
  buildValidationSchemaForComponent,
  buildValidationSchemaForField,
  createComponentResolver,
  isEmptyValue
}

/**
 * Loads full field definitions (including option values) for the given
 * components.
 */
export async function getComponentDefinitions(
  componentIds: string[],
  organisationId: string,
  siteId: string
): Promise<ComponentDefinition[]> {
  const idList = Array.from(new Set(componentIds.filter(Boolean)))
  if (idList.length === 0) return []

  const rows = await useDrizzle()
    .select({
      componentId: components.id,
      componentName: components.name,
      componentDisplayName: components.displayName,
      fieldKey: componentFields.fieldKey,
      type: componentFields.type,
      required: componentFields.required,
      displayName: componentFields.displayName,
      componentWhitelist: componentFields.componentWhitelist,
      minValue: componentFields.minValue,
      maxValue: componentFields.maxValue
    })
    .from(components)
    .leftJoin(
      componentFields,
      and(
        eq(components.id, componentFields.componentId),
        eq(componentFields.organisationId, organisationId),
        eq(componentFields.siteId, siteId)
      )
    )
    .where(
      and(
        inArray(components.id, idList),
        eq(components.organisationId, organisationId),
        eq(components.siteId, siteId)
      )
    )

  const optionRows = await useDrizzle()
    .select({
      componentId: fieldOptions.componentId,
      fieldKey: fieldOptions.fieldKey,
      optionValue: fieldOptions.optionValue
    })
    .from(fieldOptions)
    .where(
      and(
        inArray(fieldOptions.componentId, idList),
        eq(fieldOptions.organisationId, organisationId),
        eq(fieldOptions.siteId, siteId)
      )
    )

  const optionsByField = new Map<string, { optionValue: string }[]>()
  for (const option of optionRows) {
    const key = `${option.componentId}:${option.fieldKey}`
    const list = optionsByField.get(key) || []
    list.push({ optionValue: option.optionValue })
    optionsByField.set(key, list)
  }

  const definitions: ComponentDefinition[] = []
  const byId = new Map<string, ComponentDefinition>()

  for (const row of rows) {
    let component = byId.get(row.componentId)
    if (!component) {
      component = {
        id: row.componentId,
        name: row.componentName,
        displayName: row.componentDisplayName,
        fields: []
      }
      byId.set(row.componentId, component)
      definitions.push(component)
    }
    if (!row.fieldKey || !row.type) continue

    component.fields.push({
      fieldKey: row.fieldKey,
      type: row.type as FieldDefinition["type"],
      required: row.required ?? false,
      displayName: row.displayName,
      minValue: row.minValue,
      maxValue: row.maxValue,
      componentWhitelist: Array.isArray(row.componentWhitelist)
        ? (row.componentWhitelist as string[])
        : [],
      options: optionsByField.get(`${row.componentId}:${row.fieldKey}`) || []
    })
  }

  return definitions
}

/**
 * Loads field definitions for the given components and returns a resolver
 * keyed by id and by lowercased component name (which is what component
 * whitelists store).
 */
export async function getComponentResolver(
  componentIds: string[],
  organisationId: string,
  siteId: string
): Promise<ComponentResolver> {
  const definitions = await getComponentDefinitions(componentIds, organisationId, siteId)
  return createComponentResolver(definitions)
}

/**
 * Loads field definitions for every component of a site.
 */
export async function getSiteComponentDefinitions(
  organisationId: string,
  siteId: string
): Promise<ComponentDefinition[]> {
  const allComponents = await useDrizzle()
    .select({ id: components.id })
    .from(components)
    .where(and(eq(components.organisationId, organisationId), eq(components.siteId, siteId)))

  return getComponentDefinitions(
    allComponents.map((c) => c.id),
    organisationId,
    siteId
  )
}

/**
 * Returns a resolver backed by every component definition of a site. Needed
 * when arbitrary nested blocks may appear in the payload.
 */
export async function getSiteComponentResolver(
  organisationId: string,
  siteId: string
): Promise<ComponentResolver> {
  const definitions = await getSiteComponentDefinitions(organisationId, siteId)
  return createComponentResolver(definitions)
}

/**
 * Validates a full story content object (`{ [language]: content }`) against
 * the component schema for every language. Issue paths are prefixed with the
 * language code, e.g. `["en", "blocks", 0, "content", "title"]`.
 *
 * The site-wide resolver is intentional. A whitelist must still be enforced
 * when its allowed component does not currently appear in the story.
 */
export async function validateStoryContent(
  content: Record<string, unknown>,
  componentId: string,
  organisationId: string,
  siteId: string,
  languagesToValidate?: string[]
): Promise<{ success: boolean; issues: { path: (string | number)[]; message: string }[] }> {
  const [resolveComponent, [site]] = await Promise.all([
    getSiteComponentResolver(organisationId, siteId),
    useDrizzle()
      .select({ defaultLanguage: sites.defaultLanguage })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.organisationId, organisationId)))
      .limit(1)
  ])
  const issues = validateStoryContentWithResolver(
    content,
    componentId,
    resolveComponent,
    site?.defaultLanguage,
    languagesToValidate
  )
  return { success: issues.length === 0, issues }
}

/**
 * Throws a 400 validation error carrying the issue list so clients can
 * display meaningful per-field messages.
 */
export function throwValidationError(
  issues: { path: (string | number)[]; message: string }[]
): never {
  const summary = issues
    .slice(0, 3)
    .map((issue) => `[${issue.path.join(".")}] ${issue.message}`)
    .join("; ")

  throw createError({
    statusCode: 400,
    statusMessage: `Content validation failed: ${summary}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ""}`,
    data: { issues }
  })
}
