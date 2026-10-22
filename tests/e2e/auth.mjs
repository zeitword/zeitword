import { Hash } from "@adonisjs/hash"
import { Scrypt } from "@adonisjs/hash/drivers/scrypt"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { Pool } from "pg"
import { request, chromium } from "playwright"

// A fresh, disposable database is mandatory. This test runs the real migrations.
const dsn = process.env.TEST_DSN
assert.ok(dsn, "Set TEST_DSN to a fresh disposable PostgreSQL database")
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(dsn).hostname))
const pool = new Pool({ connectionString: dsn })
const database = drizzle({ client: pool })
const port = Number(process.env.TEST_PORT || 3198)
const baseURL = `http://127.0.0.1:${port}`
const secret = "local-auth-migration-test-secret-at-least-32"
const temporary = await mkdtemp(join(tmpdir(), "zeitword-auth-"))
let server
let browser
const clients = []
let serverLog = ""
const userId = randomUUID()
const archivedUserId = randomUUID()
const archivedPatId = randomUUID()
const organisationId = randomUUID()
const siteId = randomUUID()
const siteKeyId = randomUUID()
const password = "Legacy-password-123"
const legacyHash = await new Hash(new Scrypt({})).make(password)
const email = "legacy@example.test"
const migrationPath = "server/database/migrations"
const migrationName = "20261022122455_better-auth"

async function client() {
  const http = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } })
  clients.push(http)
  return http
}
async function ok(response, expected = 200) {
  assert.equal(response.status(), expected, `${response.url()}: ${await response.text()}`)
  return response.json()
}
async function post(http, path, data = {}) {
  return http.post(path, { data })
}
async function signIn(http, address = email, pass = password) {
  return ok(await post(http, "/api/auth/sign-in/email", { email: address, password: pass }))
}
async function sql(query, values = []) {
  return (await pool.query(query, values)).rows
}

try {
  assert.equal(
    (await sql("select to_regclass('public.users') as name"))[0].name,
    null,
    "Database must be empty"
  )
  for (const entry of await readdir(migrationPath)) {
    if (entry < migrationName)
      await cp(join(migrationPath, entry), join(temporary, entry), { recursive: true })
  }
  await migrate(database, { migrationsFolder: temporary })
  await sql("insert into organisations (id,name) values ($1,'Legacy organisation')", [
    organisationId
  ])
  await sql(
    "insert into users (id,name,email,password,organisation_id,reset_password_token) values ($1,'Legacy user',$2,$3,$4,'legacy-reset-link')",
    [userId, "Legacy@Example.Test", legacyHash, organisationId]
  )
  await sql("insert into sessions (token,user_id) values ('legacy-session',$1)", [userId])
  await sql(
    "insert into users (id,name,email,password,organisation_id,deleted_at,created_at) values ($1,'Archived','archived@example.test',$2,$3,now(),now()-interval '1 year')",
    [archivedUserId, legacyHash, organisationId]
  )
  await sql(
    "insert into personal_access_tokens (id,name,user_id,organisation_id,hash,last_four_chars) values ($1,'Archived token',$2,$3,$4,'-123')",
    [archivedPatId, archivedUserId, organisationId, await new Hash(new Scrypt({})).make(password)]
  )
  await sql("insert into sites (id,name,organisation_id) values ($1,'Legacy site',$2)", [
    siteId,
    organisationId
  ])
  await sql(
    "insert into site_api_keys (id,name,site_id,organisation_id,hash) values ($1,'Legacy key',$2,$3,$4)",
    [siteKeyId, siteId, organisationId, legacyHash]
  )
  const patId = randomUUID()
  await sql(
    "insert into personal_access_tokens (id,name,user_id,organisation_id,hash,last_four_chars) values ($1,'Legacy token',$2,$3,$4,'-123')",
    [patId, userId, organisationId, legacyHash]
  )
  const invitationToken = "legacy-invitation-token-" + randomUUID()
  await sql(
    "insert into user_invitations (id,email,token,invited_by,organisation_id,expires_at) values ($1,'Invited@Example.Test',$2,$3,$4,now()+interval '1 day')",
    [randomUUID(), invitationToken, userId, organisationId]
  )

  // The preflight must fail without partially modifying the old schema.
  const duplicateId = randomUUID()
  await sql(
    "insert into users (id,name,email,password,organisation_id) values ($1,'Duplicate',$2,$3,$4)",
    [duplicateId, email, legacyHash, organisationId]
  )
  await assert.rejects(
    migrate(database, { migrationsFolder: migrationPath }),
    /duplicate|migration|query/i
  )
  assert.equal((await sql("select to_regclass('public.auth_accounts') as name"))[0].name, null)
  await sql("delete from users where id=$1", [duplicateId])
  await migrate(database, { migrationsFolder: migrationPath })
  const [imported] = await sql(
    "select u.id,u.email,u.email_verified,a.password,a.account_id from users u join auth_accounts a on a.user_id=u.id where u.id=$1",
    [userId]
  )
  assert.equal(imported.id, userId)
  assert.equal(imported.account_id, userId)
  assert.equal(imported.email, email)
  assert.equal(imported.email_verified, false)
  assert.equal(imported.password, legacyHash)
  assert.ok(
    (await sql("select deleted_at from personal_access_tokens where id=$1", [archivedPatId]))[0]
      .deleted_at
  )
  assert.equal((await sql("select to_regclass('public.sessions') as name"))[0].name, null)
  assert.equal((await sql("select count(*)::int as count from auth_sessions"))[0].count, 0)

  server = spawn(process.execPath, [".output/server/index.mjs"], {
    env: {
      ...process.env,
      NUXT_DSN: dsn,
      NUXT_AUTH_SECRET: secret,
      NUXT_PUBLIC_APP_URL: baseURL,
      HOST: "127.0.0.1",
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  server.stdout.on("data", (chunk) => {
    serverLog += chunk
  })
  server.stderr.on("data", (chunk) => {
    serverLog += chunk
  })
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog)
    try {
      if ((await fetch(`${baseURL}/up`)).ok) break
    } catch {}
    if (attempt === 99) throw new Error("App did not start")
    await delay(100)
  }

  const legacy = await client()
  assert.equal((await legacy.get("/api/me")).status(), 401)
  await signIn(legacy)
  assert.equal((await ok(await legacy.get("/api/me"))).id, userId)
  const session = await ok(await legacy.get("/api/auth/get-session"))
  assert.equal(session.session.organisationId, organisationId)
  assert.equal((await ok(await legacy.get("/api/me"))).role, "owner")
  assert.ok(
    (await sql("select deleted_at from organisation_members where user_id=$1", [archivedUserId]))[0]
      .deleted_at
  )
  assert.ok(!("password" in session.user))
  const pat = await client()
  assert.equal(
    (
      await pat.get("/api/sites", {
        headers: { authorization: `Bearer zwpat_${patId}_${password}` }
      })
    ).status(),
    200
  )
  assert.equal(
    (
      await pat.get("/api/v1/stories", {
        headers: { authorization: `Bearer zeitword_${siteKeyId}_${password}` }
      })
    ).status(),
    200
  )
  assert.equal(
    (
      await post(legacy, "/api/auth/sign-up/email", {
        email: "bypass@example.test",
        name: "Bypass",
        password,
        organisationId
      })
    ).status(),
    400
  )
  const csrf = await legacy.post("/api/register", {
    headers: { origin: "https://evil.test" },
    data: { email: "attack@example.test", password, name: "Bad", organisationName: "Bad" }
  })
  assert.equal(csrf.status(), 403)
  const wrongOrigin = await legacy.post("/api/auth/sign-in/email", {
    headers: { origin: "https://evil.test" },
    data: { email, password }
  })
  assert.equal(wrongOrigin.status(), 403)

  // Duplicate registration races cannot leave orphaned organisations.
  const signup = {
    name: "New user",
    email: "new@example.test",
    password,
    organisationName: "New organisation"
  }
  const first = await client()
  const second = await client()
  const responses = await Promise.all([
    post(first, "/api/register", signup),
    post(second, "/api/register", signup)
  ])
  assert.deepEqual(responses.map((response) => response.status()).sort(), [200, 409])
  assert.equal(
    (await sql("select count(*)::int as count from organisations where name='New organisation'"))[0]
      .count,
    1
  )
  const newUser = (await sql("select id from users where email=$1", [signup.email]))[0]
  assert.equal(
    (
      await sql("select count(*)::int as count from auth_sessions where user_id=$1", [newUser.id])
    )[0].count,
    1
  )
  const winner = responses[0].status() === 200 ? first : second
  assert.equal((await ok(await winner.get("/api/me"))).id, newUser.id)
  assert.deepEqual(await ok(await winner.get("/api/sites")), [])
  // Unknown identity fields cannot alter the session's organisation.
  await post(winner, "/api/auth/update-user", { organisationId, name: "Updated name" })
  assert.notEqual((await ok(await winner.get("/api/me"))).organisationId, organisationId)

  // A failure at the final session insert must roll back all onboarding writes.
  await sql(`CREATE FUNCTION fail_test_session() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND email='fail@example.test') THEN
        RAISE EXCEPTION 'Injected session failure';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER fail_test_session BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION fail_test_session();`)
  const failed = await post(winner, "/api/register", {
    ...signup,
    email: "fail@example.test",
    organisationName: "Must roll back"
  })
  assert.ok(failed.status() >= 400)
  assert.equal(
    (await sql("select count(*)::int as count from organisations where name='Must roll back'"))[0]
      .count,
    0
  )
  assert.equal(
    (await sql("select count(*)::int as count from users where email='fail@example.test'"))[0]
      .count,
    0
  )
  await sql("DROP TRIGGER fail_test_session ON auth_sessions; DROP FUNCTION fail_test_session();")

  const invited = await client()
  const competing = await client()
  const acceptBody = { name: "Invited", password, confirmPassword: password }
  const accepted = await Promise.all([
    post(invited, `/api/invitations/${invitationToken}/accept`, acceptBody),
    post(competing, `/api/invitations/${invitationToken}/accept`, acceptBody)
  ])
  assert.deepEqual(accepted.map((response) => response.status()).sort(), [200, 400])
  const member = accepted[0].status() === 200 ? invited : competing
  const memberData = await ok(await member.get("/api/me"))
  const [oldMemberSession] = await sql("select * from auth_sessions where user_id=$1", [
    memberData.id
  ])
  assert.equal(memberData.organisationId, organisationId)
  assert.equal(
    (await sql("select email_verified from users where id=$1", [memberData.id]))[0].email_verified,
    true
  )

  // Owners alone can remove members, and ownership cannot be removed.
  await signIn(legacy)
  await ok(await member.put(`/api/organisations/users/${userId}/archive`, { data: {} }), 403)
  await ok(await legacy.put(`/api/organisations/users/${userId}/archive`, { data: {} }), 400)
  await ok(await legacy.put(`/api/organisations/users/${memberData.id}/archive`, { data: {} }))
  assert.equal((await member.get("/api/me")).status(), 403)
  await signIn(member, memberData.email)
  assert.deepEqual((await ok(await member.get("/api/organisations"))).organisations, [])
  assert.equal(
    (
      await winner.put(`/api/organisations/users/${memberData.id}/unarchive`, { data: {} })
    ).status(),
    404
  )
  await ok(await legacy.put(`/api/organisations/users/${memberData.id}/unarchive`, { data: {} }))
  assert.equal((await member.get("/api/me")).status(), 403)
  await signIn(member, memberData.email)

  // A session inserted by a concurrent login using pre-archive user data must
  // stay invalid after unarchive, even if it missed the session deletion.
  await sql("update auth_sessions set membership_version=$1 where user_id=$2", [
    oldMemberSession.membership_version,
    memberData.id
  ])
  assert.equal((await member.get("/api/me")).status(), 403)
  await signIn(member, memberData.email)

  // Invitations add membership without moving the identity or changing passwords.
  const originalHash = (
    await sql("select password from auth_accounts where user_id=$1", [memberData.id])
  )[0].password
  const otherOrg = (await ok(await winner.get("/api/me"))).organisationId
  await ok(await post(member, `/api/organisations/${otherOrg}/switch`), 403)
  const transfer = await ok(
    await post(winner, "/api/organisations/invitations", { email: memberData.email })
  )
  assert.ok(!("token" in transfer.invitation))
  assert.equal((await ok(await member.get("/api/me"))).organisationId, organisationId)
  // Retrieve the mail secret from the test database (never from the inviter API).
  const [transferInvitation] = await sql("select token from user_invitations where id=$1", [
    transfer.invitation.id
  ])
  const unauthenticated = await client()
  await ok(
    await post(unauthenticated, `/api/invitations/${transferInvitation.token}/accept`, acceptBody),
    401
  )
  await ok(await post(legacy, `/api/invitations/${transferInvitation.token}/accept`, {}), 401)
  await ok(await post(member, `/api/invitations/${transferInvitation.token}/accept`, {}))
  assert.equal(
    (await ok(await member.get("/api/me"))).organisationId,
    (await ok(await winner.get("/api/me"))).organisationId
  )
  assert.equal(
    (await sql("select password from auth_accounts where user_id=$1", [memberData.id]))[0].password,
    originalHash
  )
  assert.equal((await ok(await member.get("/api/organisations"))).organisations.length, 2)
  assert.deepEqual(await ok(await member.get("/api/sites")), [])
  const org2Pat = await ok(await post(member, "/api/tokens", { name: "Second organisation" }))
  const otherSession = await client()
  await signIn(otherSession, memberData.email)
  assert.equal((await ok(await otherSession.get("/api/me"))).organisationId, organisationId)
  await ok(await post(member, `/api/organisations/${organisationId}/switch`))
  const org1Pat = await ok(await post(member, "/api/tokens", { name: "First organisation" }))
  assert.ok((await ok(await member.get("/api/sites"))).length)
  await ok(await post(member, `/api/organisations/${otherOrg}/switch`))
  await ok(await legacy.put(`/api/organisations/users/${memberData.id}/archive`, { data: {} }))
  assert.equal((await ok(await member.get("/api/me"))).organisationId, otherOrg)
  assert.equal((await otherSession.get("/api/me")).status(), 403)
  assert.equal(
    (await sql("select deleted_at from personal_access_tokens where name='First organisation'"))[0]
      .deleted_at instanceof Date,
    true
  )
  assert.equal(
    (await sql("select deleted_at from personal_access_tokens where name='Second organisation'"))[0]
      .deleted_at,
    null
  )
  await ok(await post(member, `/api/organisations/${organisationId}/switch`), 403)
  // A member can create an independent workspace and is its owner.
  const createdOrg = await ok(
    await post(member, "/api/organisations", { name: "Third organisation" })
  )
  assert.equal((await ok(await member.get("/api/me"))).role, "owner")
  assert.equal((await ok(await member.get("/api/me"))).organisationId, createdOrg.id)
  assert.equal((await ok(await winner.get("/api/organisations"))).organisations.length, 1)
  // The same email can receive independent invitations from different orgs.
  const pendingA = await ok(
    await post(legacy, "/api/organisations/invitations", { email: "pending@example.test" })
  )
  const pendingB = await ok(
    await post(winner, "/api/organisations/invitations", { email: "pending@example.test" })
  )
  assert.notEqual(pendingA.invitation.id, pendingB.invitation.id)
  assert.equal(
    (
      await sql(
        "select count(*)::int as count from user_invitations where email='pending@example.test'"
      )
    )[0].count,
    2
  )
  assert.equal(
    (
      await pat.get("/api/sites", { headers: { authorization: `Bearer ${org1Pat.token}` } })
    ).status(),
    401
  )
  assert.equal(
    (
      await pat.get("/api/sites", { headers: { authorization: `Bearer ${org2Pat.token}` } })
    ).status(),
    200
  )

  // Exercise generated reset links through the same auth configuration, replacing
  // only email delivery. The HTTP app then consumes the real database token.
  const { createAuth } = await import("../../server/auth.ts")
  let resetURL
  const auth = createAuth(database, {
    secret,
    baseURL,
    sendPasswordReset: async ({ url }) => {
      resetURL = url
    }
  })
  const unknownReset = await auth.api.requestPasswordReset({
    body: { email: "unknown@example.test", redirectTo: `${baseURL}/reset-password` }
  })
  assert.equal(resetURL, undefined)
  const knownReset = await auth.api.requestPasswordReset({
    body: { email, redirectTo: `${baseURL}/reset-password` }
  })
  assert.deepEqual(knownReset, unknownReset)
  assert.ok(resetURL)
  const recovery = await client()
  const redirect = await recovery.get(resetURL, { maxRedirects: 0 })
  assert.equal(redirect.status(), 302)
  const resetToken = new URL(redirect.headers().location, baseURL).searchParams.get("token")
  assert.ok(resetToken)
  const newPassword = "Changed-password-456"
  assert.equal(
    (
      await post(recovery, "/api/auth/reset-password", { token: resetToken, newPassword: "short" })
    ).status(),
    400
  )
  await ok(await post(recovery, "/api/auth/reset-password", { token: resetToken, newPassword }))
  assert.equal(
    (await post(recovery, "/api/auth/reset-password", { token: resetToken, newPassword })).status(),
    400
  )
  assert.equal((await legacy.get("/api/me")).status(), 401)

  const [expiredSession] = await sql("select id from auth_sessions where user_id=$1 limit 1", [
    newUser.id
  ])
  await sql("update auth_sessions set expires_at=now()-interval '1 second' where id=$1", [
    expiredSession.id
  ])
  assert.equal((await winner.get("/api/me")).status(), 401)
  assert.equal((await post(legacy, "/api/auth/sign-in/email", { email, password })).status(), 401)
  await signIn(legacy, email, newPassword)
  await ok(await post(legacy, "/api/auth/sign-out"))
  assert.equal((await legacy.get("/api/me")).status(), 401)

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ baseURL })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/login")
  await page.locator("input#email").fill(email)
  await page.locator("input#password").fill(newPassword)
  await page.getByRole("button", { name: "Login", exact: true }).click()
  await page.waitForURL("**/sites")
  await page.reload()
  assert.match(page.url(), /\/sites$/)
  // Exercise actual workspace creation and switching, including tenant cache reset.
  await page.getByRole("button", { name: "Switch organisation", exact: true }).waitFor()
  const documentMarker = randomUUID()
  await page.evaluate((marker) => {
    window.__documentMarker = marker
    window.__originalHeader = document.querySelector("header")
  }, documentMarker)
  await page.getByRole("button", { name: "Switch organisation", exact: true }).click()
  await page.getByRole("menuitem", { name: "New organisation" }).click()
  await page.getByRole("dialog", { name: "New organisation" }).waitFor()
  assert.match(page.url(), /\/sites$/)
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page.getByRole("button", { name: "Switch organisation", exact: true }).click()
  await page.getByRole("menuitem", { name: "New organisation" }).click()
  await page.getByRole("textbox", { name: "Organisation name" }).fill("Browser workspace")
  await page.getByRole("button", { name: "Create", exact: true }).click()
  await page.getByText("Switching organisation…", { exact: true }).waitFor({ state: "hidden" })
  await page.getByRole("link", { name: "Browser workspace", exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__documentMarker), documentMarker)
  assert.equal(
    await page.evaluate(() => window.__originalHeader === document.querySelector("header")),
    true
  )
  assert.equal(await page.getByText("Legacy site", { exact: true }).count(), 0)
  // A rejected switch keeps the current organisation and releases the loading UI.
  await page.route(`**/api/organisations/${organisationId}/switch`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ statusMessage: "Denied" })
    })
  )
  await page.getByRole("button", { name: "Switch organisation", exact: true }).click()
  await page.getByRole("menuitemradio", { name: /Legacy organisation/ }).click()
  await page.getByText("Unable to switch organisation", { exact: true }).waitFor()
  await page.getByText("Switching organisation…", { exact: true }).waitFor({ state: "hidden" })
  await page.getByRole("link", { name: "Browser workspace", exact: true }).waitFor()
  await page.unroute(`**/api/organisations/${organisationId}/switch`)
  await page.getByRole("button", { name: "Switch organisation", exact: true }).click()
  await page.getByRole("menuitemradio", { name: /Legacy organisation/ }).click()
  await page.getByText("Switching organisation…", { exact: true }).waitFor({ state: "hidden" })
  await page.getByText("Legacy site", { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__documentMarker), documentMarker)
  assert.equal(
    await page.evaluate(() => window.__originalHeader === document.querySelector("header")),
    true
  )
  // Switching from a site-specific layout also navigates client-side to /sites.
  await page.getByText("Legacy site", { exact: true }).click()
  await page.waitForURL(`**/sites/${siteId}/stories`)
  await page.getByRole("button", { name: "Add Story", exact: true }).waitFor()
  await page.getByRole("button", { name: "Switch organisation", exact: true }).click()
  await page.getByRole("menuitemradio", { name: /Browser workspace/ }).click()
  await page.waitForURL("**/sites")
  await page.getByText("Switching organisation…", { exact: true }).waitFor({ state: "hidden" })
  assert.equal(await page.evaluate(() => window.__documentMarker), documentMarker)
  assert.equal(await page.getByText("Legacy site", { exact: true }).count(), 0)
  await page.goto("/logout")
  await page.waitForURL("**/login")
  assert.deepEqual(errors, [])
  console.log(
    "PASS: migration rollback, legacy credentials/PATs, multi-org membership isolation, scoped revocation, invitations, password recovery, browser workspace creation/switching and login/logout"
  )
} catch (error) {
  console.error(serverLog)
  throw error
} finally {
  await browser?.close()
  for (const http of clients) await http.dispose()
  if (server && server.exitCode === null) {
    server.kill("SIGTERM")
    await new Promise((resolve) => server.once("exit", resolve))
  }
  await pool.end()
  await rm(temporary, { recursive: true, force: true })
}
