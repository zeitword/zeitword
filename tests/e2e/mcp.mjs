import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID, createHash } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { Pool } from "pg"
import { chromium, request } from "playwright"

import { testContentEditing } from "./mcp-content.mjs"

const dsn = process.env.TEST_DSN
assert.ok(dsn, "Set TEST_DSN to an empty disposable local database")
assert.ok(["localhost", "127.0.0.1"].includes(new URL(dsn).hostname))
const pool = new Pool({ connectionString: dsn })
const port = Number(process.env.TEST_PORT ?? 3201)
const base = `http://127.0.0.1:${port}`
let server, browser, page
let log = ""
const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } })
async function json(response) {
  assert.ok(response.ok(), await response.text())
  return response.json()
}
async function sql(query, params = []) {
  return (await pool.query(query, params)).rows
}
try {
  assert.equal((await sql("select to_regclass('public.users') as name"))[0].name, null)
  await migrate(drizzle({ client: pool }), { migrationsFolder: "server/database/migrations" })
  server = spawn(process.execPath, [".output/server/index.mjs"], {
    env: {
      ...process.env,
      NUXT_DSN: dsn,
      NUXT_AUTH_SECRET: "local-mcp-test-secret-at-least-thirty-two-characters",
      NUXT_PUBLIC_APP_URL: base,
      PORT: String(port),
      HOST: "127.0.0.1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  server.stdout.on("data", (d) => {
    log += d
  })
  server.stderr.on("data", (d) => {
    log += d
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/up")).ok) break
    } catch {}
    await delay(100)
  }
  const email = "mcp@example.test",
    password = "Mcp-password-12345"
  await json(
    await api.post("/api/register", {
      data: { name: "MCP user", email, password, organisationName: "Workspace A" }
    })
  )
  const [{ id: userId }] = await sql("select id from users where email=$1", [email])
  await json(await api.post("/api/organisations", { data: { name: "Workspace B" } }))
  const workspaces = await sql("select id,name from organisations order by name")
  const otherOrg = randomUUID(),
    otherUser = randomUUID(),
    otherSite = randomUUID()
  await sql("insert into organisations(id,name) values($1,'Someone else')", [otherOrg])
  await sql("insert into users(id,name,email) values($1,'Other','other@example.test')", [otherUser])
  await sql(
    "insert into organisation_members(id,user_id,organisation_id,role) values($1,$2,$3,'owner')",
    [randomUUID(), otherUser, otherOrg]
  )
  const siteIds = []
  for (const org of workspaces) {
    const id = randomUUID()
    siteIds.push(id)
    await sql("insert into sites(id,name,organisation_id) values($1,$2,$3)", [
      id,
      org.name + " site",
      org.id
    ])
  }
  await sql("insert into sites(id,name,organisation_id) values($1,'Other site',$2)", [
    otherSite,
    otherOrg
  ])
  const oauthClient = await json(
    await api.post("/api/auth/oauth2/create-client", {
      data: {
        client_name: "MCP test client",
        application_type: "native",
        redirect_uris: [base + "/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "openid profile offline_access mcp:read mcp:write"
      }
    })
  )
  const unauthenticated = await fetch(base + "/mcp", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" }
  })
  assert.equal(unauthenticated.status, 401)
  assert.match(unauthenticated.headers.get("www-authenticate"), /resource_metadata/)
  const resource = await (await fetch(base + "/.well-known/oauth-protected-resource/mcp")).json()
  assert.equal(resource.resource, base + "/mcp")
  const discovery = await (
    await fetch(base + "/.well-known/oauth-authorization-server/api/auth")
  ).json()
  assert.equal(discovery.client_id_metadata_document_supported, true)
  assert.equal(discovery.registration_endpoint, undefined)
  assert.equal((await fetch(base + "/mcp")).status, 405)

  const verifier = randomUUID() + randomUUID()
  const state = randomUUID()
  const authorize = new URL(discovery.authorization_endpoint)
  authorize.search = new URLSearchParams({
    client_id: oauthClient.client_id,
    redirect_uri: base + "/callback",
    response_type: "code",
    scope: "openid profile offline_access mcp:read",
    resource: base + "/mcp",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256"
  }).toString()
  browser = await chromium.launch()
  page = await browser.newPage()
  await page.route(base + "/callback**", (route) => route.fulfill({ body: "Connected" }))
  await page.goto(authorize.href)
  const signedQuery = new URL(page.url()).search.slice(1)
  const tampered = signedQuery.replace("mcp%3Aread", "mcp%3Awrite")
  assert.notEqual(tampered, signedQuery)
  assert.equal(
    (await api.get("/api/mcp/authorization", { params: { query: tampered } })).status(),
    400
  )
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Authorize", exact: true }).waitFor()
  await page.getByText("MCP test client", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Authorize", exact: true }).click()
  await page.waitForURL(base + "/callback**")
  const callback = new URL(page.url())
  assert.equal(callback.searchParams.get("state"), state)
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauthClient.client_id,
      redirect_uri: base + "/callback",
      code: callback.searchParams.get("code"),
      code_verifier: verifier,
      resource: base + "/mcp"
    })
  })
  const tokens = await tokenResponse.json()
  assert.equal(tokenResponse.status, 200, JSON.stringify(tokens))
  assert.ok(tokens.refresh_token)
  const sdk = new Client(
    { name: "Zeitword integration test", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  )
  await sdk.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    })
  )
  assert.ok((await sdk.listTools()).tools.some((t) => t.name === "list_workspaces"))
  await sdk.close()
  async function rpc(method, params = {}, token = tokens.access_token, version = "2026-07-28") {
    if (version === "2026-07-28")
      params = {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": version,
          "io.modelcontextprotocol/clientCapabilities": {}
        }
      }
    const response = await fetch(base + "/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": version,
        "Mcp-Method": method,
        ...(params.name ? { "Mcp-Name": params.name } : {})
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params })
    })
    const text = await response.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = JSON.parse(
        text
          .split("\n")
          .find((l) => l.startsWith("data: "))
          .slice(6)
      )
    }
    return { status: response.status, body, headers: response.headers }
  }
  const list = await rpc("tools/call", { name: "list_workspaces", arguments: {} })
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.deepEqual(list.body.result.structuredContent.data.map((w) => w.name).sort(), [
    "Workspace A",
    "Workspace B"
  ])
  assert.equal(list.headers.get("mcp-session-id"), null)
  const parallel = await Promise.all(
    workspaces.map((w) =>
      rpc("tools/call", { name: "list_sites", arguments: { workspaceId: w.id } })
    )
  )
  parallel.forEach((r, i) => assert.equal(r.body.result.structuredContent.data[0].id, siteIds[i]))
  assert.equal(
    (await rpc("tools/call", { name: "get_site", arguments: { siteId: otherSite } })).body.result
      .isError,
    true
  )
  assert.equal(
    (await rpc("tools/call", { name: "list_sites", arguments: { workspaceId: otherOrg } })).body
      .result.isError,
    true
  )
  // Step up the same account/client to write access through real consent.
  const writeAuthorize = new URL(authorize)
  writeAuthorize.searchParams.set("scope", "openid profile offline_access mcp:read mcp:write")
  await page.goto(writeAuthorize.href)
  await page.getByRole("button", { name: "Authorize", exact: true }).click()
  await page.waitForURL(base + "/callback**")
  const writerResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauthClient.client_id,
      redirect_uri: base + "/callback",
      code: new URL(page.url()).searchParams.get("code"),
      code_verifier: verifier,
      resource: base + "/mcp"
    })
  })
  const writer = await writerResponse.json()
  assert.equal(writerResponse.status, 200, JSON.stringify(writer))
  await testContentEditing({
    rpc,
    sql,
    siteIds,
    workspaces,
    userId,
    otherSite,
    writerToken: writer.access_token,
    readerToken: tokens.access_token
  })
  // Removing only write consent must stop writes while reads remain usable.
  await sql("update oauth_consents set scopes=ARRAY['openid','mcp:read'] where client_id=$1", [
    oauthClient.client_id
  ])
  assert.equal(
    (await rpc("tools/call", { name: "create_story", arguments: {} }, writer.access_token)).status,
    401
  )
  assert.equal((await rpc("tools/list", {}, writer.access_token)).status, 200)
  await sql("update sites set deleted_at=now() where id=$1", [siteIds[0]])
  assert.deepEqual(
    (await rpc("tools/call", { name: "list_sites", arguments: { workspaceId: workspaces[0].id } }))
      .body.result.structuredContent.data,
    []
  )
  assert.equal(
    (await rpc("tools/call", { name: "get_site", arguments: { siteId: siteIds[0] } })).body.result
      .isError,
    true
  )
  await sql(
    "update organisation_members set deleted_at=now() where user_id=$1 and organisation_id=$2",
    [userId, workspaces[1].id]
  )
  assert.equal(
    (await rpc("tools/call", { name: "get_site", arguments: { siteId: siteIds[1] } })).body.result
      .isError,
    true
  )
  assert.equal((await rpc("tools/list", {}, "invalid")).status, 401)
  assert.notEqual(
    (
      await rpc(
        "initialize",
        {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "old", version: "1" }
        },
        tokens.access_token,
        "2025-11-25"
      )
    ).status,
    200
  )
  const refreshed = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: oauthClient.client_id,
      refresh_token: tokens.refresh_token,
      resource: base + "/mcp"
    })
  })
  const next = await refreshed.json()
  assert.equal(refreshed.status, 200, JSON.stringify(next))
  assert.equal((await rpc("tools/list", {}, next.access_token)).status, 200)
  await sql("update oauth_clients set disabled=true where client_id=$1", [oauthClient.client_id])
  assert.equal((await rpc("tools/list", {}, next.access_token)).status, 401)
  await sql("update oauth_clients set disabled=false where client_id=$1", [oauthClient.client_id])
  await sql("update oauth_consents set scopes=ARRAY['openid'] where client_id=$1", [
    oauthClient.client_id
  ])
  assert.equal((await rpc("tools/list", {}, next.access_token)).status, 401)
  await sql("update oauth_consents set scopes=ARRAY['openid','mcp:read'] where client_id=$1", [
    oauthClient.client_id
  ])
  assert.equal((await rpc("tools/list", {}, next.access_token)).status, 200)
  await sql("update users set deleted_at=now() where id=$1", [userId])
  assert.equal((await rpc("tools/list", {}, next.access_token)).status, 401)
  const replay = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauthClient.client_id,
      redirect_uri: base + "/callback",
      code: callback.searchParams.get("code"),
      code_verifier: verifier,
      resource: base + "/mcp"
    })
  })
  assert.equal(replay.status, 400)
  console.log(
    "PASS: real browser OAuth/PKCE, discovery, refresh, stateless parallel workspace access, tenant isolation, deletion and membership/account revocation"
  )
} catch (error) {
  if (page) console.error(page.url(), await page.locator("body").innerText())
  console.error(log)
  throw error
} finally {
  await browser?.close()
  await api.dispose()
  server?.kill()
  await pool.end()
}
