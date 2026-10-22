import { LexoRank } from "lexorank"
import { createHash } from "node:crypto"
import { z } from "zod"

import { fieldTypeEnum } from "../database/schema"
import { fieldKey } from "./content"

export const componentMetadata = z.object({
  name: fieldKey,
  displayName: z.string().trim().min(1).max(255),
  previewImage: z.string().max(2048).nullable().optional(),
  previewField: fieldKey.nullable().optional(),
  renderPreview: z.boolean().optional()
})
export const schemaField = z
  .object({
    fieldKey,
    type: z.enum(fieldTypeEnum.enumValues),
    order: z
      .string()
      .max(128)
      .refine((value) => {
        try {
          LexoRank.parse(value)
          return true
        } catch {
          return false
        }
      }, "Invalid LexoRank")
      .optional(),
    displayName: z.string().max(255).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    required: z.boolean().default(false),
    defaultValue: z.string().nullable().optional(),
    minValue: z.number().int().min(0).max(2147483647).nullable().optional(),
    maxValue: z.number().int().min(0).max(2147483647).nullable().optional(),
    config: z.json().optional(),
    componentWhitelist: z.array(fieldKey).max(500).nullable().default([]),
    options: z
      .array(
        z.object({
          id: z.uuid(),
          optionName: z.string().min(1).max(255),
          optionValue: z.string().min(1).max(255)
        })
      )
      .max(1000)
      .default([])
  })
  .refine(
    (f) => f.minValue == null || f.maxValue == null || f.minValue <= f.maxValue,
    "minValue exceeds maxValue"
  )
export const schemaFields = z
  .array(schemaField)
  .max(500)
  .superRefine((fields, ctx) => {
    const keys = new Set<string>(),
      ids = new Set<string>()
    for (const field of fields) {
      const values = new Set<string>()
      if (keys.has(field.fieldKey)) ctx.addIssue({ code: "custom", message: "Duplicate field key" })
      keys.add(field.fieldKey)
      if (field.options.length && !["option", "options"].includes(field.type))
        ctx.addIssue({ code: "custom", message: "Only option/options fields accept options" })
      if (field.componentWhitelist?.length && field.type !== "blocks")
        ctx.addIssue({ code: "custom", message: "Only blocks fields accept a component whitelist" })
      for (const option of field.options) {
        if (ids.has(option.id) || values.has(option.optionValue))
          ctx.addIssue({ code: "custom", message: "Duplicate option ID or value" })
        ids.add(option.id)
        values.add(option.optionValue)
      }
    }
  })
export type SchemaFields = z.infer<typeof schemaFields>

// Compare create retries using writable values, ignoring server-generated timestamps.
export function componentDefinition(schema: Record<string, any>) {
  let rank = LexoRank.middle()
  const fields = (schema.fields ?? [])
    .map((field: Record<string, any>) => {
      const definition = {
        fieldKey: field.fieldKey,
        type: field.type,
        order: field.order ?? rank.toString(),
        displayName: field.displayName ?? null,
        description: field.description ?? null,
        required: field.required ?? false,
        defaultValue: field.defaultValue ?? null,
        minValue: field.minValue ?? null,
        maxValue: field.maxValue ?? null,
        config: field.config ?? null,
        componentWhitelist: field.componentWhitelist ?? [],
        options: (field.options ?? [])
          .map((option: Record<string, any>) => ({
            id: option.id,
            optionName: option.optionName,
            optionValue: option.optionValue
          }))
          .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      }
      rank = rank.genNext()
      return definition
    })
    .sort(
      (a: { order: string; fieldKey: string }, b: { order: string; fieldKey: string }) =>
        a.order.localeCompare(b.order) || a.fieldKey.localeCompare(b.fieldKey)
    )
  return {
    name: schema.name,
    displayName: schema.displayName,
    previewImage: schema.previewImage ?? null,
    previewField: schema.previewField ?? null,
    renderPreview: schema.renderPreview ?? false,
    fields
  }
}

// Include values as well as timestamps: dashboard field writes do not bump the parent timestamp.
export function schemaRevision(schema: unknown): string {
  function canonical(value: any): any {
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical(value[key])])
      )
    return value
  }
  return createHash("sha256")
    .update(JSON.stringify(canonical(schema)))
    .digest("hex")
}
