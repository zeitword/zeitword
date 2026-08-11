import { describe, expect, it } from "vitest"
import { withDefaultBlockStructure } from "~~/shared/block-structure"

const rootFields = [{ fieldKey: "blocks", type: "blocks" }]
const components = [
  {
    id: "hero",
    fields: [
      { fieldKey: "heading", type: "text" },
      { fieldKey: "children", type: "blocks" }
    ]
  },
  {
    id: "text",
    fields: [{ fieldKey: "body", type: "textarea" }]
  }
]

const defaultContent = {
  blocks: [
    {
      id: "hero-1",
      componentId: "hero",
      componentName: "hero",
      order: "a",
      content: {
        heading: "Default heading",
        children: [
          {
            id: "text-1",
            componentId: "text",
            componentName: "text",
            order: "a",
            content: { body: "Default body" }
          }
        ]
      }
    }
  ]
}

describe("withDefaultBlockStructure", () => {
  it("projects sparse default block wrappers into an empty translation", () => {
    const result = withDefaultBlockStructure({ blocks: [] }, defaultContent, rootFields, components)

    expect(result).toEqual({
      blocks: [
        {
          id: "hero-1",
          componentId: "hero",
          componentName: "hero",
          order: "a",
          content: {
            children: [
              {
                id: "text-1",
                componentId: "text",
                componentName: "text",
                order: "a",
                content: {}
              }
            ]
          }
        }
      ]
    })
    expect(defaultContent.blocks[0]!.content.heading).toBe("Default heading")
  })

  it("preserves translated values while filling empty nested block structure", () => {
    const result = withDefaultBlockStructure(
      {
        blocks: [
          {
            id: "hero-1",
            componentId: "hero",
            order: "a",
            content: { heading: "Deutsche Überschrift", children: [] }
          }
        ]
      },
      defaultContent,
      rootFields,
      components
    )

    expect((result.blocks as any[])[0].content.heading).toBe("Deutsche Überschrift")
    expect((result.blocks as any[])[0].content.children).toEqual([
      {
        id: "text-1",
        componentId: "text",
        componentName: "text",
        order: "a",
        content: {}
      }
    ])
  })

  it("does not replace an existing translated block structure", () => {
    const translated = {
      blocks: [
        {
          id: "other-1",
          componentId: "text",
          order: "a",
          content: { body: "Eigenständig" }
        }
      ]
    }

    expect(withDefaultBlockStructure(translated, defaultContent, rootFields, components)).toEqual(
      translated
    )
  })
})
