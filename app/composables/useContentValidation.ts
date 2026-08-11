import {
  createComponentResolver,
  validateStoryContent,
  type ComponentDefinition,
  type ComponentResolver,
  type StoryContentIssue
} from "~~/shared/field-schema"

/**
 * A validation issue enriched with everything the story editor needs to
 * guide the user to the exact input: resolved block ids, readable labels
 * and the field key the message belongs to.
 */
export type EnrichedIssue = StoryContentIssue & {
  // key used to look up the inline message of the innermost field
  fieldKey: string
  // block ids from the outermost wrapper down to the block containing the
  // field (empty for top level fields)
  blockIds: string[]
  // the block the field belongs to (undefined for top level fields)
  blockId?: string
  // e.g. "Cards > Hero > Title"
  label: string
}

type WalkContext = {
  // display names of the components walked so far
  crumbs: string[]
  // block ids along the walked path
  blockIds: string[]
}

/**
 * Fetches the component definitions of a site and validates story content
 * client-side against them, using the exact same schema builders the
 * server uses.
 */
export function useContentValidation() {
  const validationSchema = shallowRef<{
    componentId: string
    components: ComponentDefinition[]
  } | null>(null)

  async function load(siteId: string, componentId: string) {
    if (!siteId || !componentId) {
      validationSchema.value = null
      return
    }
    try {
      validationSchema.value = await $fetch(`/api/sites/${siteId}/components/${componentId}/schema`)
    } catch (error) {
      console.error("Failed to load validation schema", error)
      validationSchema.value = null
    }
  }

  function getResolver(): ComponentResolver | null {
    const schema = validationSchema.value
    if (!schema) return null
    return createComponentResolver(schema.components)
  }

  function validate(
    content: Record<string, unknown>,
    defaultLanguage?: string
  ): StoryContentIssue[] {
    const schema = validationSchema.value
    const resolveComponent = getResolver()
    if (!schema || !resolveComponent) return []
    return validateStoryContent(content, schema.componentId, resolveComponent, defaultLanguage)
  }

  /**
   * Maps an issue path to block ids and readable labels by descending the
   * content tree. Paths whose structure changed after the validation ran
   * fall back to their raw path segments.
   */
  function enrichIssue(
    issue: StoryContentIssue,
    content: Record<string, unknown>,
    resolver: ComponentResolver,
    rootComponentId: string
  ): EnrichedIssue {
    const [language, ...segments] = issue.path
    const fallbackKey = typeof segments.at(-1) === "string" ? (segments.at(-1) as string) : ""

    const walk = (
      component: ComponentDefinition | undefined,
      value: unknown,
      rest: (string | number)[],
      ctx: WalkContext
    ): EnrichedIssue | null => {
      if (rest.length === 0) return null

      const [head, ...tail] = rest
      const field = component?.fields.find((f) => f.fieldKey === head)

      if (field?.type === "blocks" && tail.length > 0) {
        // issue inside one of the blocks (or one nested deeper below)
        const [index, ...afterIndex] = tail
        const blockTail = afterIndex[0] === "content" ? afterIndex.slice(1) : afterIndex
        const fieldValue =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[field.fieldKey]
            : undefined
        const items = Array.isArray(fieldValue) ? fieldValue : []
        const block = typeof index === "number" ? items[index] : undefined
        const blockId =
          block && typeof block === "object" && typeof (block as any).id === "string"
            ? ((block as any).id as string)
            : `__index_${index}`
        const childComponent =
          block && typeof block === "object" && typeof (block as any).componentId === "string"
            ? resolver((block as any).componentId)
            : undefined
        const childCtx = {
          crumbs: [...ctx.crumbs, childComponent?.displayName || childComponent?.name || `Block`],
          blockIds: [...ctx.blockIds, blockId]
        }
        const nested = walk(
          childComponent,
          block && typeof block === "object" ? (block as any).content : undefined,
          blockTail,
          childCtx
        )
        // nested field found or issue sits on the blocks field itself
        return (
          nested ?? {
            ...issue,
            fieldKey: field.fieldKey,
            blockIds: [...ctx.blockIds],
            blockId: ctx.blockIds.at(-1),
            label: [...ctx.crumbs, field.displayName || field.fieldKey].join(" > ")
          }
        )
      }

      // issue on a direct field of this component
      const fieldKey = typeof head === "string" ? head : ""
      return {
        ...issue,
        fieldKey,
        blockIds: [...ctx.blockIds],
        blockId: ctx.blockIds.at(-1),
        label: [...ctx.crumbs, field?.displayName || fieldKey].filter(Boolean).join(" > ")
      }
    }

    const result = walk(resolver(rootComponentId), content[language], segments, {
      crumbs: [],
      blockIds: []
    })

    return (
      result ?? {
        ...issue,
        fieldKey: fallbackKey,
        blockIds: [],
        label: segments.filter((s) => s !== "content").join(" > ")
      }
    )
  }

  function enrichIssues(
    issues: StoryContentIssue[],
    content: Record<string, unknown>
  ): EnrichedIssue[] {
    const schema = validationSchema.value
    const resolveComponent = getResolver()
    if (!schema || !resolveComponent) {
      return issues.map((issue) => ({
        ...issue,
        fieldKey: typeof issue.path.at(-1) === "string" ? (issue.path.at(-1) as string) : "",
        blockIds: [],
        label: issue.path.join(" > ")
      }))
    }
    return issues.map((issue) => enrichIssue(issue, content, resolveComponent, schema.componentId))
  }

  /** Key identifying the innermost field location of an issue. */
  function issueKey(issue: EnrichedIssue, language: string): string {
    return [language, ...issue.blockIds, issue.fieldKey].join(":")
  }

  return { load, validate, enrichIssues, issueKey }
}
