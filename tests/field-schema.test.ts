import { describe, expect, it } from "vitest"
import {
  buildValidationSchemaForComponent,
  createComponentResolver,
  isEmptyValue,
  validateStoryContent,
  type ComponentDefinition
} from "~~/shared/field-schema"

const text: ComponentDefinition = {
  id: "c-text",
  name: "text",
  fields: [
    {
      fieldKey: "title",
      type: "text",
      required: true,
      displayName: "Title",
      minValue: 3,
      maxValue: 10
    },
    { fieldKey: "tagline", type: "text", required: false, displayName: "Tagline", minValue: 5 }
  ]
}

const number: ComponentDefinition = {
  id: "c-number",
  name: "number",
  fields: [
    {
      fieldKey: "count",
      type: "number",
      required: true,
      displayName: "Count",
      minValue: 1,
      maxValue: 5
    },
    { fieldKey: "rating", type: "number", required: false, displayName: "Rating", maxValue: 3 }
  ]
}

const richtext: ComponentDefinition = {
  id: "c-richtext",
  name: "richtext",
  fields: [{ fieldKey: "body", type: "richtext", required: true, displayName: "Body" }]
}

const link: ComponentDefinition = {
  id: "c-link",
  name: "link",
  fields: [
    { fieldKey: "optional", type: "link", required: false, displayName: "Optional" },
    { fieldKey: "required", type: "link", required: true, displayName: "Required" }
  ]
}

const option: ComponentDefinition = {
  id: "c-option",
  name: "option",
  fields: [
    {
      fieldKey: "size",
      type: "option",
      required: true,
      displayName: "Size",
      options: [{ optionValue: "s" }, { optionValue: "m" }]
    }
  ]
}

const blocks: ComponentDefinition = {
  id: "c-page",
  name: "page",
  fields: [
    {
      fieldKey: "blocks",
      type: "blocks",
      required: true,
      displayName: "Blocks",
      componentWhitelist: ["text"],
      minValue: 1,
      maxValue: 2
    }
  ]
}

const collections: ComponentDefinition = {
  id: "c-collections",
  name: "collections",
  fields: [
    {
      fieldKey: "assets",
      type: "assets",
      displayName: "Assets",
      minValue: 1,
      maxValue: 2
    },
    {
      fieldKey: "tags",
      type: "options",
      displayName: "Tags",
      options: [{ optionValue: "one" }, { optionValue: "two" }, { optionValue: "three" }],
      minValue: 1,
      maxValue: 2
    }
  ]
}

const resolver = createComponentResolver([
  text,
  number,
  richtext,
  link,
  option,
  blocks,
  collections
])

const schema = (id: string) => buildValidationSchemaForComponent(id, resolver)
const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? "PASS" : result.error!.issues.map((i) => i.message)

describe("isEmptyValue", () => {
  it("treats empty strings, null, undefined, empty arrays and objects as empty", () => {
    expect(isEmptyValue("")).toBe(true)
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined)).toBe(true)
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue({})).toBe(true)
  })

  it("treats real values as non-empty", () => {
    expect(isEmptyValue("a")).toBe(false)
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue([0])).toBe(false)
    expect(isEmptyValue({ a: 1 })).toBe(false)
  })
})

describe("text fields", () => {
  it("requires a non-empty value", () => {
    expect(messages(schema("c-text").safeParse({}))).toEqual([`"Title" is required`])
    expect(messages(schema("c-text").safeParse({ title: "" }))).toEqual([`"Title" is required`])
    expect(messages(schema("c-text").safeParse({ title: undefined }))).toEqual([
      `"Title" is required`
    ])
  })

  it("enforces min and max on present values", () => {
    expect(messages(schema("c-text").safeParse({ title: "ab" }))).toEqual([
      "Must be at least 3 characters"
    ])
    expect(messages(schema("c-text").safeParse({ title: "01234567890" }))).toEqual([
      "Must be at most 10 characters"
    ])
  })

  it("enforces optional min only when a value is present", () => {
    expect(messages(schema("c-text").safeParse({ title: "Hello", tagline: "" }))).toBe("PASS")
    expect(messages(schema("c-text").safeParse({ title: "Hello" }))).toBe("PASS")
    expect(messages(schema("c-text").safeParse({ title: "Hello", tagline: "abc" }))).toEqual([
      "Must be at least 5 characters"
    ])
  })
})

describe("number fields", () => {
  it("fails required numbers on empty strings instead of coercing to 0", () => {
    expect(messages(schema("c-number").safeParse({ count: "" }))).toEqual([`"Count" is required`])
    expect(messages(schema("c-number").safeParse({}))).toEqual([`"Count" is required`])
  })

  it("coerces numeric strings and enforces min/max", () => {
    expect(messages(schema("c-number").safeParse({ count: "3" }))).toBe("PASS")
    expect(messages(schema("c-number").safeParse({ count: "0" }))).toEqual(["Must be at least 1"])
    expect(messages(schema("c-number").safeParse({ count: "9" }))).toEqual(["Must be at most 5"])
  })

  it("validates optional min/max only when present", () => {
    expect(messages(schema("c-number").safeParse({ count: "3", rating: "" }))).toBe("PASS")
    expect(messages(schema("c-number").safeParse({ count: "3", rating: "5" }))).toEqual([
      "Must be at most 3"
    ])
  })
})

describe("richtext fields", () => {
  it("counts html without text as empty for required fields", () => {
    expect(messages(schema("c-richtext").safeParse({ body: "" }))).toEqual([`"Body" is required`])
    expect(messages(schema("c-richtext").safeParse({ body: "<p></p>" }))).toEqual([
      `"Body" is required`
    ])
    expect(messages(schema("c-richtext").safeParse({ body: "<p>hi</p>" }))).toBe("PASS")
  })

  it("rejects legacy object payloads with a clear type error", () => {
    expect(
      messages(schema("c-richtext").safeParse({ body: { type: "doc", content: [] } }))
    ).not.toBe("PASS")
  })
})

describe("link fields", () => {
  it("treats pristine link objects as empty", () => {
    expect(
      messages(
        schema("c-link").safeParse({
          optional: { url: "", type: "external" },
          required: { type: "internal", storyId: "x" }
        })
      )
    ).toBe("PASS")
    expect(
      messages(schema("c-link").safeParse({ required: { url: "", type: "external" } }))
    ).toEqual([`"Required" is required`])
  })

  it("reports empty internal links as a single required error", () => {
    // an internal link with neither storyId nor url is a pristine link and
    // therefore counts as empty (the editor defaults to this state)
    expect(
      messages(
        schema("c-link").safeParse({
          optional: { type: "internal", storyId: "x" },
          required: { type: "internal" }
        })
      )
    ).toEqual([`"Required" is required`])
  })
})

describe("option fields", () => {
  it("requires a value from the option list", () => {
    expect(messages(schema("c-option").safeParse({}))).toEqual([`"Size" is required`])
    expect(messages(schema("c-option").safeParse({ size: "xl" }))).toEqual([
      'Invalid option: expected one of "s"|"m"'
    ])
    expect(messages(schema("c-option").safeParse({ size: "s" }))).toBe("PASS")
  })
})

describe("blocks fields", () => {
  const block = (content: Record<string, unknown>) => ({ componentId: "c-text", content })

  it("enforces min items and required nested fields", () => {
    const result = schema("c-page").safeParse({ blocks: [block({ title: "" })] })
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."))
    expect(paths).toEqual(["blocks.0.content.title"])
  })

  it("fails when below the minimum amount of blocks", () => {
    expect(messages(schema("c-page").safeParse({ blocks: [] }))).toEqual([`"Blocks" is required`])
  })

  it("rejects blocks that are not whitelisted", () => {
    const result = schema("c-page").safeParse({
      blocks: [{ componentId: "c-number", content: { count: "1" } }]
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe("This block type is not allowed here")
  })

  it("enforces the maximum number of blocks", () => {
    const result = schema("c-page").safeParse({
      blocks: [block({ title: "One" }), block({ title: "Two" }), block({ title: "Three" })]
    })
    expect(messages(result)).toEqual(["Add at most 2 block(s)"])
  })
})

describe("collection fields", () => {
  const asset = (id: string) => ({ id, alt: id, src: `/${id}.jpg`, type: "image" })

  it("enforces min and max asset counts", () => {
    expect(messages(schema("c-collections").safeParse({ assets: [], tags: ["one"] }))).toEqual([
      "Pick at least 1 asset(s)"
    ])
    expect(
      messages(
        schema("c-collections").safeParse({
          assets: [asset("one"), asset("two"), asset("three")],
          tags: ["one"]
        })
      )
    ).toEqual(["Pick at most 2 asset(s)"])
  })

  it("enforces min and max option counts", () => {
    expect(
      messages(schema("c-collections").safeParse({ assets: [asset("one")], tags: [] }))
    ).toEqual(["Pick at least 1 option(s)"])
    expect(
      messages(
        schema("c-collections").safeParse({
          assets: [asset("one")],
          tags: ["one", "two", "three"]
        })
      )
    ).toEqual(["Pick at most 2 option(s)"])
  })
})

describe("validateStoryContent", () => {
  it("validates each language with the same schema and prefixes paths", () => {
    const issues = validateStoryContent(
      {
        en: { blocks: [] },
        de: { blocks: [{ componentId: "c-text", content: { title: "" } }] }
      },
      "c-page",
      resolver
    )

    expect(issues).toHaveLength(2)
    expect(issues[0]!.path[0]).toBe("en")
    expect(issues[1]!.path[0]).toBe("de")
    expect(issues[1]!.path.join(".")).toBe("de.blocks.0.content.title")
  })

  it("uses default-language content fallbacks but preserves translated block structure", () => {
    const defaultBlock = { componentId: "c-text", content: { title: "Default" } }

    const fallbackIssues = validateStoryContent(
      {
        en: { blocks: [defaultBlock] },
        de: {}
      },
      "c-page",
      resolver,
      "en"
    )
    expect(fallbackIssues).toEqual([])

    const structureIssues = validateStoryContent(
      {
        en: { blocks: [defaultBlock] },
        de: { blocks: [] }
      },
      "c-page",
      resolver,
      "en"
    )
    expect(structureIssues[0]!.path.join(".")).toBe("de.blocks")
  })

  it("validates only the languages edited in a partial save", () => {
    const content = {
      en: { blocks: [{ componentId: "c-text", content: { title: "Valid" } }] },
      de: { blocks: [] }
    }

    expect(validateStoryContent(content, "c-page", resolver, "en", ["en"])).toEqual([])

    const issues = validateStoryContent(content, "c-page", resolver, "en", ["de"])
    expect(issues).toHaveLength(1)
    expect(issues[0]!.path.join(".")).toBe("de.blocks")
  })

  it("carries the required detail code through nested blocks", () => {
    const issues = validateStoryContent(
      { en: { blocks: [{ componentId: "c-text", content: { title: "" } }] } },
      "c-page",
      resolver
    )
    expect(issues[0]!.path.join(".")).toBe("en.blocks.0.content.title")
    expect(issues[0]!.detailCode).toBe("zeitword.required")
  })
})
