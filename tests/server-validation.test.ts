import { describe, expect, it } from "vitest"
import { createComponentResolver } from "~~/server/utils/validation"

describe("server validation exports", () => {
  it("creates a component resolver at runtime", () => {
    const component = {
      id: "component-id",
      name: "component-name",
      displayName: "Component name",
      fields: []
    }
    const resolveComponent = createComponentResolver([component])

    expect(resolveComponent(component.id)).toBe(component)
    expect(resolveComponent(component.name)).toBe(component)
  })
})
