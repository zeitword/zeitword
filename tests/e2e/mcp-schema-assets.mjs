import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "node:http"

export async function startAssetStorage() {
  const objects = new Map()
  let puts = 0
  const server = createServer(async (req, res) => {
    const key = new URL(req.url, "http://storage.test").pathname
    if (req.method === "HEAD") {
      const object = objects.get(key)
      if (!object) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, { "content-type": object.type, "content-length": object.body.length })
      res.end()
      return
    }
    if (req.method === "PUT") {
      if (objects.has(key) && req.headers["if-none-match"] === "*") {
        res.writeHead(412)
        res.end()
        return
      }
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      objects.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"] })
      puts++
      res.writeHead(200, { etag: '"test-etag"' })
      res.end()
      return
    }
    res.writeHead(405)
    res.end()
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return {
    server,
    objects,
    puts: () => puts,
    endpoint: `http://127.0.0.1:${server.address().port}`
  }
}

export async function testSchemaAssets({
  rpc,
  sql,
  workspaceId,
  otherSite,
  userId,
  writerToken,
  readerToken,
  storage
}) {
  const call = async (name, args, token = writerToken) => {
    const response = await rpc("tools/call", { name, arguments: args }, token)
    assert.equal(response.status, 200, JSON.stringify(response.body))
    return response.body.result
  }
  const ok = async (name, args) => {
    const result = await call(name, args)
    assert.ok(!result.isError, JSON.stringify(result))
    return result.structuredContent.data
  }
  const fail = async (name, args, code) => {
    const result = await call(name, args)
    assert.equal(result.isError, true, JSON.stringify(result))
    if (code) assert.equal(result.structuredContent.error.code, code, JSON.stringify(result))
  }
  const siteId = randomUUID()
  await ok("create_site", { workspaceId, id: siteId, name: "Schema and asset test" })
  const componentId = randomUUID(),
    optionId = randomUUID()
  const input = {
    siteId,
    id: componentId,
    name: "migration_page",
    displayName: "Page",
    fields: [
      { fieldKey: "title", type: "text", required: true },
      {
        fieldKey: "kind",
        type: "option",
        options: [{ id: optionId, optionName: "News", optionValue: "news" }]
      },
      { fieldKey: "children", type: "blocks", componentWhitelist: ["migration_page"] }
    ]
  }
  for (const name of ["create_component", "update_component", "import_asset", "upload_asset"]) {
    const response = await rpc("tools/call", { name, arguments: {} }, readerToken)
    assert.equal(response.status, 403)
    assert.match(response.headers.get("www-authenticate"), /mcp:write/)
  }
  const created = await ok("create_component", input)
  assert.equal(created.fields[1].options[0].id, optionId)
  assert.deepEqual(created.fields[2].componentWhitelist, ["migration_page"])
  assert.equal((await ok("get_component", { siteId, componentId })).revision, created.revision)
  assert.equal((await ok("create_component", input)).revision, created.revision)
  await fail("create_component", { ...input, displayName: "Different" }, "CONFLICT")
  await fail("create_component", { ...input, id: randomUUID() }, "CONFLICT")
  await fail(
    "create_component",
    {
      ...input,
      id: randomUUID(),
      name: "bad",
      fields: [{ fieldKey: "blocks", type: "blocks", componentWhitelist: ["foreign"] }]
    },
    "VALIDATION"
  )
  await fail("create_component", { ...input, siteId: otherSite }, "NOT_FOUND")
  await fail(
    "update_component",
    { siteId: otherSite, componentId, expectedRevision: created.revision, displayName: "No" },
    "NOT_FOUND"
  )
  const update = {
    siteId,
    componentId,
    expectedRevision: created.revision,
    displayName: "Edited page"
  }
  const contenders = await Promise.all([
    call("update_component", update),
    call("update_component", { ...update, displayName: "Other edit" })
  ])
  assert.equal(contenders.filter((r) => !r.isError).length, 1)
  assert.equal(contenders.find((r) => r.isError).structuredContent.error.code, "CONFLICT")
  let schema = await ok("get_component", { siteId, componentId })
  assert.equal(schema.fields.length, 3)
  // Dashboard-style changes without parent timestamp updates still invalidate the revision.
  await sql(
    "update component_fields set description='dashboard edit' where component_id=$1 and field_key='title'",
    [componentId]
  )
  await fail("update_component", { ...update, expectedRevision: schema.revision }, "CONFLICT")
  schema = await ok("get_component", { siteId, componentId })
  const replacement = await ok("update_component", {
    siteId,
    componentId,
    expectedRevision: schema.revision,
    fields: input.fields.slice(0, 2)
  })
  assert.equal(replacement.fields.length, 2)
  assert.equal(replacement.fields[1].options[0].id, optionId)
  const foreignOptionComponent = randomUUID()
  await ok("create_component", {
    siteId,
    id: foreignOptionComponent,
    name: "other",
    displayName: "Other",
    fields: [
      {
        fieldKey: "choice",
        type: "option",
        options: [{ id: randomUUID(), optionName: "A", optionValue: "a" }]
      }
    ]
  })
  const badOptionId = (await ok("get_component", { siteId, componentId: foreignOptionComponent }))
    .fields[0].options[0].id
  await fail(
    "update_component",
    {
      siteId,
      componentId,
      expectedRevision: replacement.revision,
      fields: [
        {
          fieldKey: "choice",
          type: "option",
          options: [{ id: badOptionId, optionName: "A", optionValue: "a" }]
        }
      ]
    },
    "CONFLICT"
  )
  assert.equal((await ok("get_component", { siteId, componentId })).revision, replacement.revision)
  const story = await ok("create_story", {
    siteId,
    id: randomUUID(),
    title: "Page",
    slug: "page",
    componentId,
    content: { en: { title: "Valid page", kind: "news" } }
  })
  assert.equal(story.componentId, componentId)

  const upload = {
    siteId,
    id: randomUUID(),
    fileName: "test.png",
    contentType: "image/png",
    base64: Buffer.from("test image bytes").toString("base64")
  }
  const before = storage.puts()
  const uploads = await Promise.all([ok("upload_asset", upload), ok("upload_asset", upload)])
  assert.equal(uploads[0].id, upload.id)
  assert.equal(uploads[0].src, uploads[1].src)
  assert.equal(uploads[0].fileSize, 16)
  assert.equal(uploads[0].type, "image")
  assert.equal(storage.puts(), before + 1)
  assert.equal((await ok("get_asset", { siteId, assetId: upload.id })).src, uploads[0].src)
  await fail("upload_asset", { ...upload, fileName: "different.png" }, "CONFLICT")
  await fail("upload_asset", { ...upload, siteId: otherSite }, "NOT_FOUND")
  await fail("upload_asset", { ...upload, id: randomUUID(), base64: "!!!!" }, "IMPORT_FAILED")
  const importId = randomUUID()
  await fail(
    "import_asset",
    { siteId, id: importId, fileName: "private", url: "http://127.0.0.1/private" },
    "IMPORT_FAILED"
  )
  assert.equal((await sql("select id from assets where id=$1", [importId])).length, 0)
  // Simulate successful storage followed by a lost DB transaction: same inputs reuse bytes.
  await sql("delete from assets where id=$1", [upload.id])
  await ok("upload_asset", upload)
  assert.equal(storage.puts(), before + 1)
  await sql(
    "update organisation_members set deleted_at=now() where organisation_id=$1 and user_id=$2",
    [workspaceId, userId]
  )
  await fail("upload_asset", { ...upload, id: randomUUID() }, "NOT_FOUND")
  await fail("create_component", { ...input, id: randomUUID() }, "NOT_FOUND")
  await sql(
    "update organisation_members set deleted_at=null where organisation_id=$1 and user_id=$2",
    [workspaceId, userId]
  )
  await sql("delete from stories where site_id=$1", [siteId])
  await sql("delete from field_options where site_id=$1", [siteId])
  await sql("delete from component_fields where site_id=$1", [siteId])
  await sql("delete from components where site_id=$1", [siteId])
  await sql("delete from assets where site_id=$1", [siteId])
  await sql("delete from site_languages where site_id=$1", [siteId])
  await sql("delete from sites where id=$1", [siteId])
  console.log(
    "PASS: schema writes/revisions, concurrent updates, field/option replacement rollback, asset upload/idempotence/recovery, private URL rejection and authorization"
  )
}
