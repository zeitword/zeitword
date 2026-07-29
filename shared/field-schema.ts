import { z } from "zod"

export const REQUIRED_ISSUE_CODE = "zeitword.required"

export const fieldTypesList = [
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
] as const

/**
 * Definition of a single component field.
 * Shared between server and client, so it tolerates null values coming from
 * the database.
 */
export const fieldDefinitionSchema = z.looseObject({
  fieldKey: z.string().min(1),
  type: z.enum(fieldTypesList),
  required: z.boolean().nullish(),
  displayName: z.string().nullish(),
  minValue: z.number().nullish(),
  maxValue: z.number().nullish(),
  componentWhitelist: z.array(z.string()).nullish(),
  options: z
    .array(
      z.looseObject({
        optionValue: z.string()
      })
    )
    .nullish()
})

export const componentDefinitionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullish(),
  fields: z.array(fieldDefinitionSchema)
})

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>
export type ComponentResolver = (idOrName: string) => ComponentDefinition | undefined

/**
 * Builds a resolver from a flat list of component definitions. Components
 * can be resolved both by id and by lowercased name (whitelists store
 * names).
 */
export function createComponentResolver(components: ComponentDefinition[]): ComponentResolver {
  const byKey = new Map<string, ComponentDefinition>()
  for (const component of components) {
    if (!component) continue
    if (component.id) byKey.set(component.id, component)
    if (component.name) byKey.set(component.name.toLowerCase(), component)
  }
  return (key) => byKey.get(key)
}

const assetSchema = z.looseObject({
  id: z.string().optional(),
  alt: z.string().min(1),
  src: z.string().min(1),
  type: z.enum(["image", "video", "audio", "pdf", "other"])
})

const linkSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("external"),
    url: z.string().min(1)
  }),
  z
    .looseObject({
      type: z.literal("internal"),
      storyId: z.string().optional(),
      url: z.string().optional()
    })
    .superRefine((value, ctx) => {
      if (!value.storyId && !value.url) {
        ctx.addIssue({
          code: "custom",
          message: "Select a page or enter a URL"
        })
      }
    })
])

// A link object where nothing is picked yet counts as "no value", so
// optional fields stay clean and required fields report exactly one
// "required" issue instead of a type error.
function isEmptyLinkValue(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return true
  if (typeof value !== "object") return false
  const { type, url, storyId } = value as { type?: string; url?: string; storyId?: string }
  if (type === "external") return !url
  if (type === "internal") return !storyId && !url
  return false
}

const ISODateTimeString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" })

export function isEmptyValue(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).length === 0
  }
  return false
}

/**
 * Checks raw (pre-coercion) values for emptiness. Richtext is stored as
 * html, so markup without any actual text content counts as empty as well.
 */
function isEmptyFieldValue(value: unknown, type: FieldDefinition["type"]): boolean {
  if (type === "link") return isEmptyLinkValue(value)
  if (type === "richtext" && typeof value === "string") {
    if (value.trim() === "") return true
    const text = value
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim()
    return text === ""
  }
  return isEmptyValue(value)
}

/**
 * Builds the zod schema for a single field value, enforcing configured
 * min/max constraints. For required fields, an emptiness check against the
 * raw value is piped in front, so emptiness always yields exactly one
 * "required" issue instead of type-specific errors (e.g. z.coerce.number()
 * would otherwise turn "" into 0 and pass).
 */
export function buildValidationSchemaForField(
  field: FieldDefinition,
  resolveComponent: ComponentResolver,
  isRequired = false
): z.ZodTypeAny {
  const min = field.minValue ?? undefined
  const max = field.maxValue ?? undefined
  const label = field.displayName || field.fieldKey

  let schema: z.ZodTypeAny

  switch (field.type) {
    case "text":
    case "textarea":
    case "markdown": {
      let s = z.string()
      if (min != null) s = s.min(min, { message: `Must be at least ${min} characters` })
      if (max != null) s = s.max(max, { message: `Must be at most ${max} characters` })
      schema = s
      break
    }
    case "richtext":
      // the editor stores richtext as an html string
      schema = z.string()
      break
    case "number": {
      // the editor submits numeric strings from html inputs
      let s = z.coerce.number()
      if (min != null) s = s.min(min, { message: `Must be at least ${min}` })
      if (max != null) s = s.max(max, { message: `Must be at most ${max}` })
      schema = s
      break
    }
    case "datetime":
      schema = ISODateTimeString
      break
    case "boolean":
      schema = z.boolean()
      break
    case "link":
      schema = linkSchema
      // empty link objects pass through untouched; the required pipe and
      // the optional union (z.literal("")/z.null()) only cover primitive
      // empties, so pristine link objects are mapped to undefined here
      schema = z.union([
        z.custom((value) => isEmptyLinkValue(value)).transform(() => undefined),
        schema
      ])
      break
    case "asset":
      schema = assetSchema
      break
    case "assets": {
      let s = z.array(assetSchema)
      if (min != null) s = s.min(min, { message: `Pick at least ${min} asset(s)` })
      if (max != null) s = s.max(max, { message: `Pick at most ${max} asset(s)` })
      schema = s
      break
    }
    case "option": {
      const allowed = field.options?.map((o) => o.optionValue).filter((v) => v !== "") || []
      schema = allowed.length > 0 ? z.enum(allowed) : z.string()
      break
    }
    case "options": {
      const allowed = field.options?.map((o) => o.optionValue).filter((v) => v !== "") || []
      let s = z.array(allowed.length > 0 ? z.enum(allowed) : z.string())
      if (min != null) s = s.min(min, { message: `Pick at least ${min} option(s)` })
      if (max != null) s = s.max(max, { message: `Pick at most ${max} option(s)` })
      schema = s
      break
    }
    case "blocks": {
      const blockShape = {
        id: z.string().optional(),
        componentId: z.string(),
        componentName: z.string().optional(),
        order: z.string().optional()
      }

      const allowedComponents = (field.componentWhitelist || [])
        .map((name) => resolveComponent(name.toLowerCase()))
        .filter((c): c is ComponentDefinition => c !== undefined)

      let blockSchema: z.ZodTypeAny
      if (allowedComponents.length > 0) {
        const allowedById = new Map(allowedComponents.map((c) => [c.id, c]))
        blockSchema = z.looseObject(blockShape).superRefine((block, ctx) => {
          const component = allowedById.get(block.componentId as string)
          if (!component) {
            ctx.addIssue({
              code: "custom",
              message: "This block type is not allowed here",
              path: ["componentId"]
            })
            return
          }
          const contentSchema = buildValidationSchemaForComponent(component.id, resolveComponent)
          const result = contentSchema.safeParse(block.content ?? {})
          if (!result.success) {
            for (const issue of result.error.issues) {
              ctx.addIssue({
                code: "custom",
                message: issue.message,
                path: ["content", ...(issue.path || [])],
                input: issue.input,
                params: (issue as { params?: Record<string, unknown> }).params
              })
            }
          }
        })
      } else {
        blockSchema = z.looseObject({
          ...blockShape,
          content: z.record(z.string(), z.unknown()).optional()
        })
      }

      let s = z.array(blockSchema)
      if (min != null) s = s.min(min, { message: `Add at least ${min} block(s)` })
      if (max != null) s = s.max(max, { message: `Add at most ${max} block(s)` })
      schema = s
      break
    }
    case "section":
    case "custom":
    default:
      schema = z.unknown()
      break
  }

  if (!isRequired) return schema

  // superRefine short-circuits the pipeline on empty values, so the inner
  // schema never sees them; non-empty values validate against `schema`
  return z
    .unknown()
    .superRefine((value, ctx) => {
      if (isEmptyFieldValue(value, field.type)) {
        ctx.addIssue({
          code: "custom",
          params: { code: REQUIRED_ISSUE_CODE },
          message: `"${label}" is required`
        })
      }
    })
    .pipe(schema)
}

/**
 * Builds the zod schema for the content object of one component.
 *
 * - required fields must be present and non-empty
 * - optional fields may be omitted, "", null or an empty array
 * - unknown keys pass through untouched so content saved before a field was
 *   removed from the component is not destroyed
 */
export function buildValidationSchemaForComponent(
  componentId: string,
  resolveComponent: ComponentResolver
): z.ZodTypeAny {
  const component = resolveComponent(componentId)

  if (!component) {
    return z.looseObject({}).superRefine((_data, ctx) => {
      ctx.addIssue({
        code: "custom",
        message: `Unknown component "${componentId}"`
      })
    })
  }

  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of component.fields) {
    if (!field.fieldKey) continue

    const required = field.required === true
    const valueSchema = buildValidationSchemaForField(field, resolveComponent, required)

    if (required) {
      shape[field.fieldKey] = valueSchema
    } else {
      shape[field.fieldKey] = z.union([valueSchema, z.literal(""), z.null()]).optional()
    }
  }

  return z.looseObject(shape)
}

export type StoryContentIssue = {
  // zod issue code (too_small, too_big, invalid_value, invalid_type,
  // custom, ...). `detailCode` carries our own marker for custom
  // refinements (e.g. "zeitword.required").
  code?: string
  detailCode?: string
  path: (string | number)[]
  message: string
}

/**
 * Applies the CMS language fallback rules. Explicit arrays are preserved so
 * each language keeps its own block structure, while missing or empty scalar
 * content falls back to the default language.
 */
export function mergeWithFallback(defaultValue: unknown, translatedValue: unknown): unknown {
  if (!defaultValue) return translatedValue
  if (!translatedValue) return defaultValue
  if (
    typeof defaultValue !== "object" ||
    defaultValue === null ||
    typeof translatedValue !== "object" ||
    translatedValue === null
  ) {
    return translatedValue
  }

  const fallback = defaultValue as Record<string, unknown>
  const translated = translatedValue as Record<string, unknown>
  const result: Record<string, unknown> = { ...fallback }

  for (const [key, value] of Object.entries(translated)) {
    if (typeof value === "object" && value !== null) {
      const isArrayLike =
        Array.isArray(value) || Object.keys(value).every((part) => !isNaN(Number(part)))
      result[key] = isArrayLike
        ? Array.isArray(value)
          ? value
          : Object.values(value)
        : mergeWithFallback(fallback[key] || {}, value)
    } else if (value !== null && value !== "") {
      result[key] = value
    }
  }

  return result
}

function toStoryContentIssue(issue: z.core.$ZodIssue, language: string): StoryContentIssue {
  const path = (issue.path || []).map((segment) =>
    typeof segment === "symbol" ? String(segment) : segment
  )
  const params = (issue as { params?: { code?: unknown } }).params
  return {
    code: issue.code,
    detailCode: typeof params?.code === "string" ? params.code : undefined,
    path: [language, ...path],
    message: issue.message
  }
}

/**
 * Validates a full story content object (`{ [language]: content }`) and
 * returns flat issues with paths prefixed by language code.
 */
export function validateStoryContent(
  content: Record<string, unknown>,
  componentId: string,
  resolveComponent: ComponentResolver,
  defaultLanguage?: string
): StoryContentIssue[] {
  const rootSchema = buildValidationSchemaForComponent(componentId, resolveComponent)
  const issues: StoryContentIssue[] = []
  const defaultContent = defaultLanguage ? content[defaultLanguage] : undefined

  for (const [language, languageContent] of Object.entries(content || {})) {
    if (!languageContent || typeof languageContent !== "object") continue
    const value =
      defaultLanguage && language !== defaultLanguage
        ? mergeWithFallback(defaultContent, languageContent)
        : languageContent
    const result = rootSchema.safeParse(value)
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push(toStoryContentIssue(issue, language))
      }
    }
  }

  return issues
}
