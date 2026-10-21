import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { chromium } from "playwright"

// This creates test data. Only point it at an app using a disposable local database.
assert.ok(process.env.TEST_BASE_URL, "Set TEST_BASE_URL to a disposable local app")
const baseURL = new URL(process.env.TEST_BASE_URL)
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(baseURL.hostname),
  "Only loopback hosts are allowed"
)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: baseURL.href })
const page = await context.newPage()
page.setDefaultTimeout(15_000)
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
const email = `upgrade-${randomUUID()}@example.test`
const password = "local-regression-test-password"

async function api(path, options = {}) {
  const response = await context.request.fetch(path, options)
  assert.ok(
    response.ok(),
    `${options.method || "GET"} ${path}: ${response.status()} ${await response.text()}`
  )
  return response.json()
}

try {
  assert.equal((await context.request.get("/up")).status(), 200)
  assert.equal((await context.request.get("/api/sites")).status(), 401)
  await page.goto("/register")
  await page.locator("input#name").fill("Upgrade Test")
  await page.locator("input#email").fill(email)
  await page.locator("input#password").fill(password)
  await page.locator("input#organisationName").fill("Upgrade Test Organisation")
  await page.getByRole("button", { name: "Register", exact: true }).click()
  await page.waitForURL("**/sites")
  assert.equal((await api("/api/me")).email, email)

  // Exercises Reka's modal and combobox with the current Vue and Router versions.
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByPlaceholder("Name of the site").fill("Upgrade Test Site")
  await page.getByRole("button", { name: "Add Site", exact: true }).click()
  await page.getByRole("link", { name: /Upgrade Test Site/ }).waitFor()
  const [site] = await api("/api/sites")
  assert.ok(site.id)
  const component = await api(`/api/sites/${site.id}/components`, {
    method: "POST",
    data: { name: "article", displayName: "Article" }
  })
  await api(`/api/sites/${site.id}/components/${component.id}/fields`, {
    method: "POST",
    data: { name: "body", displayName: "Body", fieldType: "richtext", order: "0|hzzzzz:" }
  })
  const story = await api(`/api/sites/${site.id}/stories`, {
    method: "POST",
    data: {
      slug: "upgrade-test",
      title: "Upgrade Test Story",
      componentId: component.id,
      content: { en: { body: "<h2>Original heading</h2><p>Original text</p>" } }
    }
  })
  const storyPath = `/sites/${site.id}/stories/story/${story.id}/content`
  await page.goto(storyPath)
  const editor = page.locator(".tiptap[contenteditable=true]")
  await editor.waitFor()
  assert.match(await editor.innerHTML(), /<h2>Original heading<\/h2>/)
  await editor.press("ControlOrMeta+End")
  await editor.press("Enter")
  await editor.pressSequentially("Edited with Tiptap 3")
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith(`/stories/${story.id}`) && response.request().method() === "PUT"
    ),
    page.getByRole("button", { name: /^Save/ }).click()
  ])
  assert.equal(saved.status(), 200)
  const persisted = await api(`/api/sites/${site.id}/stories/${story.id}`)
  assert.match(persisted.content.en.body, /Edited with Tiptap 3/)
  await page.reload()
  await editor.getByText("Edited with Tiptap 3", { exact: true }).waitFor()

  await page.goto("/logout")
  await page.waitForURL("**/login")
  assert.equal((await context.request.get("/api/sites")).status(), 401)
  await page.locator("input#email").fill(email)
  await page.locator("input#password").fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
  await page.waitForURL("**/sites")
  assert.equal((await api("/api/me")).email, email)
  await page.getByRole("link", { name: /Upgrade Test Site/ }).click()
  await page.waitForURL(`**/sites/${site.id}/stories`)
  assert.deepEqual(errors, [], "Browser runtime errors")
  console.log(
    "PASS: registration, session, site modal, story editing/persistence, logout/login, router navigation"
  )
} finally {
  await context.close()
  await browser.close()
}
