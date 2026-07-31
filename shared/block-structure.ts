type FieldLike = {
  fieldKey: string
  type: string
}

type ComponentLike = {
  id: string
  fields: FieldLike[]
}

type BlockLike = {
  id?: string
  componentId?: string
  content?: Record<string, unknown>
  [key: string]: unknown
}

function cloneValue<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

function findDefaultBlock(defaultBlocks: BlockLike[], block: BlockLike): BlockLike | undefined {
  if (!block.id) return undefined
  return defaultBlocks.find(
    (candidate) => candidate.id === block.id && candidate.componentId === block.componentId
  )
}

function scaffoldBlock(
  defaultBlock: BlockLike,
  componentsById: Map<string, ComponentLike>
): BlockLike {
  const component = defaultBlock.componentId
    ? componentsById.get(defaultBlock.componentId)
    : undefined
  const content: Record<string, unknown> = {}

  for (const field of component?.fields || []) {
    if (field.type !== "blocks") continue
    const defaultBlocks = defaultBlock.content?.[field.fieldKey]
    content[field.fieldKey] = Array.isArray(defaultBlocks)
      ? scaffoldBlocks(defaultBlocks, componentsById)
      : []
  }

  return {
    ...cloneValue(defaultBlock),
    content
  }
}

function scaffoldBlocks(
  defaultBlocks: BlockLike[],
  componentsById: Map<string, ComponentLike>
): BlockLike[] {
  return defaultBlocks.map((block) => scaffoldBlock(block, componentsById))
}

function applyNestedBlockStructure(
  translatedBlocks: BlockLike[],
  defaultBlocks: BlockLike[],
  componentsById: Map<string, ComponentLike>
): BlockLike[] {
  if (translatedBlocks.length === 0) {
    return scaffoldBlocks(defaultBlocks, componentsById)
  }

  return translatedBlocks.map((translatedBlock) => {
    const defaultBlock = findDefaultBlock(defaultBlocks, translatedBlock)
    const component = translatedBlock.componentId
      ? componentsById.get(translatedBlock.componentId)
      : undefined
    const content = cloneValue(translatedBlock.content || {})

    if (!defaultBlock || !component) {
      return { ...cloneValue(translatedBlock), content }
    }

    for (const field of component.fields) {
      if (field.type !== "blocks") continue

      const translatedNested = content[field.fieldKey]
      const defaultNested = defaultBlock.content?.[field.fieldKey]
      if (!Array.isArray(defaultNested) || defaultNested.length === 0) continue

      content[field.fieldKey] = applyNestedBlockStructure(
        Array.isArray(translatedNested) ? translatedNested : [],
        defaultNested,
        componentsById
      )
    }

    return { ...cloneValue(translatedBlock), content }
  })
}

/**
 * Adds sparse block wrappers from the default language to empty translated
 * block fields. Field values are deliberately not copied. This gives the
 * editor a structure to render while preserving its existing fallback UI.
 */
export function withDefaultBlockStructure(
  translatedContent: Record<string, unknown>,
  defaultContent: Record<string, unknown>,
  fields: FieldLike[],
  components: ComponentLike[]
): Record<string, unknown> {
  const result = cloneValue(translatedContent)
  const componentsById = new Map(components.map((component) => [component.id, component]))

  for (const field of fields) {
    if (field.type !== "blocks") continue

    const defaultBlocks = defaultContent[field.fieldKey]
    if (!Array.isArray(defaultBlocks) || defaultBlocks.length === 0) continue

    const translatedBlocks = result[field.fieldKey]
    result[field.fieldKey] = applyNestedBlockStructure(
      Array.isArray(translatedBlocks) ? translatedBlocks : [],
      defaultBlocks,
      componentsById
    )
  }

  return result
}
