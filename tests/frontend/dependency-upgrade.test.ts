import { compileScript, parse } from "@vue/compiler-sfc"
import { afterAll, expect, test } from "bun:test"
import { Window } from "happy-dom"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const window = new Window({ url: "http://localhost/" })
for (const name of [
  "window",
  "document",
  "navigator",
  "history",
  "DocumentFragment",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLButtonElement",
  "MutationObserver",
  "ResizeObserver",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "DOMRect",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame"
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === "window" ? window : window[name]
  })
}
const vue = await import("vue")
const { createApp, h, nextTick, reactive } = vue
const { createRouter, createMemoryHistory } = await import("vue-router")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const generated = await mkdtemp(resolve(root, "tests/frontend/.compiled-"))
afterAll(async () => {
  await rm(generated, { recursive: true, force: true })
  await window.happyDOM.close()
})

async function component(path: string) {
  const filename = resolve(root, path)
  const { descriptor } = parse(await readFile(filename, "utf8"), { filename })
  const compiled = compileScript(descriptor, { id: path, inlineTemplate: true })
  const autoImports = [
    "ref",
    "computed",
    "watch",
    "nextTick",
    "onMounted",
    "onBeforeUnmount",
    "useSlots"
  ].filter((name) => !Object.hasOwn(compiled.bindings, name))
  const source = `import { ${autoImports.join(", ")} } from 'vue';\n${compiled.content}`
  const file = resolve(generated, path.replaceAll("/", "-") + ".js")
  await writeFile(file, new Bun.Transpiler({ loader: "ts" }).transformSync(source))
  return (await import(file)).default
}

const Button = await component("app/components/d-button/index.vue")
const Select = await component("app/components/d-select.vue")
const RichText = await component("app/components/d-rich-text/index.vue")
const Pagination = await component("app/components/d-pagination.vue")
const Combobox = await component("app/components/d-combobox.vue")

async function mount(component: any, props: Record<string, any>, router?: any) {
  const state = reactive(props)
  const host = document.createElement("div")
  document.body.append(host)
  const app = createApp({ render: () => h(component, state) })
  app.component("DButton", Button)
  app.component("DSelect", Select)
  app.component("DKbd", { render: () => null })
  if (router) app.use(router)
  app.mount(host)
  await nextTick()
  return {
    host,
    state,
    unmount: () => {
      app.unmount()
      host.remove()
    }
  }
}

async function settle() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await nextTick()
}

test("rich text preserves headings and formatting without duplicate extensions or model feedback", async () => {
  const updates: string[] = []
  const mounted = await mount(RichText, {
    modelValue: '<h2>Heading</h2><p><u>Underline</u> <a href="https://example.com">Link</a></p>',
    "onUpdate:modelValue": (value: string) => updates.push(value)
  })
  try {
    await settle()
    const editor = (mounted.host.querySelector(".tiptap") as any).editor
    const names = editor.extensionManager.extensions.map((extension: any) => extension.name)
    expect(new Set(names).size).toBe(names.length)
    expect(editor.getHTML()).toContain("<h2>Heading</h2>")
    expect(editor.getHTML()).toContain("<u>Underline</u>")
    expect(editor.getHTML()).toContain('href="https://example.com"')
    expect(updates).toEqual([])

    mounted.state.modelValue = "<h3>External heading</h3>"
    await settle()
    expect(editor.getHTML()).toContain("<h3>External heading</h3>")
    expect(updates).toEqual([])
    editor.commands.insertContent("Edited ")
    await settle()
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.at(-1)).toContain("<h3>")

    mounted.state.modelValue = ""
    await settle()
    expect(editor.isEmpty).toBe(true)
  } finally {
    mounted.unmount()
  }
})

test("Reka select accepts heading values and the null paragraph option", async () => {
  const values: any[] = []
  const mounted = await mount(Select, {
    options: [
      { value: "h2", display: "Heading 2" },
      { value: null, display: "Paragraph" }
    ],
    modelValue: "h2",
    "onUpdate:modelValue": (value: any) => {
      values.push(value)
      mounted.state.modelValue = value
    }
  })
  try {
    const trigger = mounted.host.querySelector("button")!
    trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    await settle()
    const paragraph = Array.from(document.querySelectorAll('[role="option"]')).find((node) =>
      node.textContent?.includes("Paragraph")
    )!
    expect(paragraph).toBeDefined()
    paragraph.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    await settle()
    expect(values).toEqual([null])
  } finally {
    mounted.unmount()
  }
})

test("Reka pagination translates next page back into an offset", async () => {
  const offsets: number[] = []
  const mounted = await mount(Pagination, {
    total: 50,
    limit: 10,
    offset: 0,
    "onUpdate:offset": (value: number) => offsets.push(value)
  })
  try {
    const next = mounted.host.querySelector('[aria-label="Next Page"]') as HTMLElement
    expect(next).not.toBeNull()
    next.click()
    await settle()
    expect(offsets).toEqual([10])
  } finally {
    mounted.unmount()
  }
})

test("Reka combobox filters and selects object options", async () => {
  const values: any[] = []
  const mounted = await mount(Combobox, {
    options: [
      { value: "a", display: "Alpha" },
      { value: "b", display: "Beta" }
    ],
    modelValue: null,
    "onUpdate:modelValue": (value: any) => values.push(value)
  })
  try {
    const input = mounted.host.querySelector("input")!
    input.value = "Beta"
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    await settle()
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((node) =>
      node.textContent?.includes("Beta")
    ) as HTMLElement
    expect(option).toBeDefined()
    option.click()
    await settle()
    expect(values.at(-1)).toEqual({ value: "b", display: "Beta" })
  } finally {
    mounted.unmount()
  }
})

test("router-backed buttons navigate using Vue Router 5", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { render: () => null } },
      { path: "/target", component: { render: () => null } }
    ]
  })
  await router.push("/")
  await router.isReady()
  const mounted = await mount(Button, { to: "/target" }, router)
  try {
    const link = mounted.host.querySelector("a")!
    expect(link.getAttribute("href")).toBe("/target")
    link.click()
    await settle()
    expect(router.currentRoute.value.path).toBe("/target")
  } finally {
    mounted.unmount()
  }
})
