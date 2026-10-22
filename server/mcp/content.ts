import { LexoRank } from "lexorank"
import { z } from "zod"

// Adapted from the unfinished MCP content editor. Paths address stable block
// identities rather than array offsets, and every batch applies to a clone.
export const fieldKey = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Reserved field key"
  )
export const contentPath = z
  .array(z.union([fieldKey, z.object({ blockId: z.uuid() }).strict()]))
  .min(1)
  .max(32)
const position = z.union([
  z.enum(["start", "end"]),
  z.object({ before: z.uuid() }).strict(),
  z.object({ after: z.uuid() }).strict()
])
export const patchOperation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set"), path: contentPath, value: z.json() }).strict(),
  z.object({ op: z.literal("unset"), path: contentPath }).strict(),
  z
    .object({
      op: z.literal("insert_block"),
      path: contentPath,
      block: z
        .object({ id: z.uuid(), componentId: z.uuid(), content: z.record(fieldKey, z.json()) })
        .strict(),
      position: position.default("end")
    })
    .strict(),
  z.object({ op: z.literal("remove_block"), path: contentPath, blockId: z.uuid() }).strict(),
  z.object({ op: z.literal("move_block"), path: contentPath, blockId: z.uuid(), position }).strict()
])
export const patchInput = z
  .object({
    language: z.string().min(2).max(16),
    expectedRevision: z.string().min(1),
    operations: z.array(patchOperation).min(1).max(100),
    dryRun: z.boolean().default(false)
  })
  .strict()
export type PatchOperation = z.infer<typeof patchOperation>
export function object(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function at(root: unknown, path: z.infer<typeof contentPath>): any {
  let value = root
  for (const segment of path) {
    if (typeof segment === "string") {
      if (!object(value) || !Object.hasOwn(value, segment))
        throw new Error(`Field "${segment}" does not exist`)
      value = value[segment]
    } else {
      if (!Array.isArray(value)) throw new Error("Block selector requires a blocks array")
      const matches = value.filter((block) => object(block) && block.id === segment.blockId)
      if (matches.length !== 1)
        throw new Error(`Expected exactly one block with ID ${segment.blockId}`)
      value = matches[0]
    }
  }
  return value
}
function insertIndex(blocks: any[], target: z.infer<typeof position>): number {
  if (target === "start") return 0
  if (target === "end") return blocks.length
  const id = "before" in target ? target.before : target.after
  const index = blocks.findIndex((block) => block.id === id)
  if (index < 0) throw new Error(`Position target ${id} does not exist in this array`)
  return index + ("after" in target ? 1 : 0)
}
export function applyContentPatch(source: Record<string, any>, operations: PatchOperation[]) {
  const result = structuredClone(source)
  for (const raw of operations) {
    const op = patchOperation.parse(raw)
    if (op.op === "set" || op.op === "unset") {
      const last = op.path.at(-1)!
      if (typeof last !== "string") throw new Error("Set/unset must target a field, not a block")
      const parent = at(result, op.path.slice(0, -1))
      if (!object(parent)) throw new Error("Field parent must be an object")
      if (
        typeof parent.componentId === "string" &&
        ["id", "componentId", "order", "componentName"].includes(last)
      )
        throw new Error("Block identity and ordering must be edited with block operations")
      if (op.op === "set") parent[last] = structuredClone(op.value)
      else delete parent[last]
      continue
    }
    const blocks = at(result, op.path)
    if (
      !Array.isArray(blocks) ||
      blocks.some((block) => !object(block) || typeof block.componentId !== "string")
    )
      throw new Error("Block operation requires a blocks array")
    if (op.op === "insert_block") {
      if (blocks.some((block) => block.id === op.block.id))
        throw new Error(`Block ${op.block.id} already exists`)
      blocks.splice(insertIndex(blocks, op.position), 0, structuredClone(op.block))
    } else {
      const index = blocks.findIndex((block) => block.id === op.blockId)
      if (index < 0) throw new Error(`Block ${op.blockId} does not exist`)
      if (
        op.op === "move_block" &&
        typeof op.position === "object" &&
        Object.values(op.position).includes(op.blockId)
      )
        continue
      const [block] = blocks.splice(index, 1)
      if (op.op === "move_block") blocks.splice(insertIndex(blocks, op.position), 0, block)
    }
    let rank = LexoRank.middle()
    for (const block of blocks) {
      block.order = rank.toString()
      rank = rank.genNext()
    }
  }
  return result
}

export type ContentIssue = { path: (string | number)[]; code: string; message: string }
export type ComponentSchema = {
  id: string
  name: string
  fields: {
    fieldKey: string
    type: string
    required?: boolean
    componentWhitelist?: unknown
    options?: { optionValue: string }[]
  }[]
}
export function validateContent(
  content: unknown,
  componentId: string,
  schemas: ComponentSchema[]
): ContentIssue[] {
  const issues: ContentIssue[] = []
  const ids = new Set<string>()
  const issue = (path: (string | number)[], code: string, message: string) => {
    issues.push({ path, code, message })
  }
  function visit(value: unknown, id: string, path: (string | number)[], depth: number) {
    if (depth > 32) {
      issue(path, "depth", "Content exceeds 32 nested components")
      return
    }
    const schema = schemas.find((entry) => entry.id === id)
    if (!schema) {
      issue(path, "component", `Unknown component ${id}`)
      return
    }
    if (!object(value)) {
      issue(path, "type", "Expected a content object")
      return
    }
    for (const name of Object.keys(value)) {
      if (!schema.fields.some((field) => field.fieldKey === name))
        issue([...path, name], "unknown_field", `Unknown field in ${schema.name}`)
    }
    for (const field of schema.fields) {
      const current = value[field.fieldKey],
        fieldPath = [...path, field.fieldKey]
      if (current === undefined || current === null || current === "") {
        if (field.required) issue(fieldPath, "required", "Required field is empty")
        continue
      }
      let valid = true
      switch (field.type) {
        case "section":
        case "custom":
          break
        case "number":
          valid = typeof current === "number" && Number.isFinite(current)
          break
        case "boolean":
          valid = typeof current === "boolean"
          break
        case "datetime":
          valid = typeof current === "string" && !Number.isNaN(Date.parse(current))
          break
        case "option":
          valid =
            typeof current === "string" &&
            (!field.options?.length ||
              field.options.some((option) => option.optionValue === current))
          break
        case "options":
          valid =
            Array.isArray(current) &&
            current.every(
              (entry) =>
                typeof entry === "string" &&
                (!field.options?.length ||
                  field.options.some((option) => option.optionValue === entry))
            )
          break
        case "asset":
          valid = object(current) && typeof current.src === "string"
          break
        case "assets":
          valid =
            Array.isArray(current) &&
            current.every((entry) => object(entry) && typeof entry.src === "string")
          break
        case "link":
          valid =
            object(current) &&
            ((current.type === "external" &&
              typeof current.url === "string" &&
              current.url.length > 0) ||
              (current.type === "internal" && z.uuid().safeParse(current.storyId).success))
          break
        case "blocks": {
          valid = Array.isArray(current)
          if (!valid) break
          current.forEach((block: unknown, index: number) => {
            const blockPath = [...fieldPath, index]
            if (!object(block) || typeof block.componentId !== "string") {
              issue(blockPath, "block", "Expected a block with componentId and content")
              return
            }
            if (!z.uuid().safeParse(block.id).success || ids.has(block.id))
              issue(
                [...blockPath, "id"],
                "block_id",
                "Block IDs must be UUIDs unique within the locale"
              )
            ids.add(block.id)
            const nested = schemas.find((entry) => entry.id === block.componentId)
            if (
              Array.isArray(field.componentWhitelist) &&
              field.componentWhitelist.length &&
              nested &&
              !field.componentWhitelist.includes(nested.name)
            )
              issue(blockPath, "whitelist", `${nested.name} is not allowed in this field`)
            visit(block.content, block.componentId, [...blockPath, "content"], depth + 1)
          })
          break
        }
        default:
          valid = typeof current === "string"
      }
      if (!valid) issue(fieldPath, "type", `Expected ${field.type}`)
    }
  }
  visit(content, componentId, [], 0)
  return issues
}

export function enrichBlocks(
  content: Record<string, any>,
  componentId: string,
  schemas: ComponentSchema[],
  depth = 0
) {
  if (depth > 32) return
  for (const field of schemas.find((s) => s.id === componentId)?.fields ?? []) {
    if (field.type !== "blocks" || !Array.isArray(content[field.fieldKey])) continue
    let rank = LexoRank.middle()
    for (const block of content[field.fieldKey]) {
      block.componentName = schemas.find((s) => s.id === block.componentId)?.name
      block.order = rank.toString()
      rank = rank.genNext()
      enrichBlocks(block.content, block.componentId, schemas, depth + 1)
    }
  }
}
