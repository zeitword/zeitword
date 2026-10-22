import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

export async function testContentEditing({
  rpc,
  sql,
  siteIds,
  workspaces,
  userId,
  otherSite,
  writerToken,
  readerToken
}) {
  const call = async (name, args, token = writerToken) => {
    const response = await rpc("tools/call", { name, arguments: args }, token)
    assert.equal(response.status, 200, JSON.stringify(response.body))
    return response.body.result
  }
  const ok = async (name, args, token) => {
    const result = await call(name, args, token)
    assert.ok(!result.isError, JSON.stringify(result))
    return result.structuredContent.data
  }
  const fail = async (name, args, code) => {
    const result = await call(name, args)
    assert.equal(result.isError, true, JSON.stringify(result))
    assert.equal(result.structuredContent.error.code, code, JSON.stringify(result))
  }
  const roots = [],
    children = [],
    blocks = [],
    ids = []
  await sql(
    "insert into languages(code,name,native_name) values('de','German','Deutsch') on conflict do nothing"
  )
  const siteInputs = workspaces.map((workspace, i) => ({
    workspaceId: workspace.id,
    id: randomUUID(),
    name: `Created site ${i}`,
    ...(i === 0 ? { domain: "https://example.test", defaultLanguage: "de" } : {})
  }))
  const deniedSite = { ...siteInputs[0], id: randomUUID() }
  const denied = await rpc(
    "tools/call",
    { name: "create_site", arguments: deniedSite },
    readerToken
  )
  assert.equal(denied.status, 403)
  assert.match(denied.headers.get("www-authenticate"), /mcp:write/)
  assert.equal((await sql("select id from sites where id=$1", [deniedSite.id])).length, 0)
  const newSites = await Promise.all(siteInputs.map((input) => ok("create_site", input)))
  for (const [i, site] of newSites.entries()) {
    assert.equal(site.id, siteInputs[i].id)
    assert.equal(site.workspaceId, workspaces[i].id)
    assert.equal(site.defaultLanguage, i === 0 ? "de" : "en")
    assert.equal(site.domain, i === 0 ? "https://example.test" : "")
    assert.deepEqual(await ok("get_site", { siteId: site.id }), site)
    assert.ok(
      (await ok("list_sites", { workspaceId: workspaces[i].id })).some((s) => s.id === site.id)
    )
    assert.deepEqual(
      await sql("select language_code from site_languages where site_id=$1", [site.id]),
      [{ language_code: site.defaultLanguage }]
    )
  }
  await fail("create_site", siteInputs[0], "CONFLICT")
  const invalidSite = { ...siteInputs[0], id: randomUUID(), defaultLanguage: "unknown" }
  await fail("create_site", invalidSite, "VALIDATION")
  assert.equal((await sql("select id from sites where id=$1", [invalidSite.id])).length, 0)
  const [foreign] = await sql("select organisation_id from sites where id=$1", [otherSite])
  await fail(
    "create_site",
    { ...siteInputs[0], id: randomUUID(), workspaceId: foreign.organisation_id },
    "NOT_FOUND"
  )
  await sql("update organisations set deleted_at=now() where id=$1", [workspaces[1].id])
  await fail("create_site", { ...siteInputs[1], id: randomUUID() }, "NOT_FOUND")
  await sql("update organisations set deleted_at=null where id=$1", [workspaces[1].id])
  // Keep subsequent existing site-list assertions focused on their original fixtures.
  for (const site of newSites) {
    await sql("delete from site_languages where site_id=$1", [site.id])
    await sql("delete from sites where id=$1", [site.id])
  }
  for (let i = 0; i < siteIds.length; i++) {
    roots.push(randomUUID())
    children.push(randomUUID())
    blocks.push(randomUUID())
    ids.push(randomUUID())
    for (const language of ["en", "de"])
      await sql("insert into site_languages(site_id,language_code) values($1,$2)", [
        siteIds[i],
        language
      ])
    await sql(
      "insert into components(id,name,display_name,site_id,organisation_id) values($1,'page','Page',$3,$4),($2,'hero','Hero',$3,$4)",
      [roots[i], children[i], siteIds[i], workspaces[i].id]
    )
    for (const [component, key, type, required] of [
      [roots[i], "title", "text", true],
      [roots[i], "blocks", "blocks", false],
      [roots[i], "link", "link", false],
      [roots[i], "image", "asset", false],
      [children[i], "title", "text", true]
    ]) {
      await sql(
        "insert into component_fields(component_id,field_key,type,required,\"order\",site_id,organisation_id,component_whitelist) values($1,$2,$3,$4,'0|hzzzzz:',$5,$6,$7)",
        [
          component,
          key,
          type,
          required,
          siteIds[i],
          workspaces[i].id,
          type === "blocks" ? '["hero"]' : null
        ]
      )
    }
  }
  const inputs = siteIds.map((siteId, i) => ({
    siteId,
    id: ids[i],
    title: "MCP content " + i,
    slug: "mcp-content",
    componentId: roots[i],
    content: {
      en: {
        title: "English",
        blocks: [{ id: blocks[i], componentId: children[i], content: { title: "Original hero" } }]
      },
      de: { title: "Deutsch", blocks: [] }
    }
  }))
  const created = await Promise.all(inputs.map((input) => ok("create_story", input)))
  created.forEach((story, i) => assert.equal(story.siteId, siteIds[i]))
  await fail("create_story", inputs[0], "CONFLICT")
  await fail(
    "create_story",
    { ...inputs[0], id: randomUUID(), slug: "wrong-component", componentId: roots[1] },
    "VALIDATION"
  )
  await fail("create_story", { ...inputs[0], id: randomUUID(), siteId: otherSite }, "NOT_FOUND")
  const target = { siteId: siteIds[0], storyId: ids[0] }
  let story = await ok("get_story", { ...target, full: true }, readerToken)
  assert.equal(story.content.en.blocks[0].componentName, "hero")
  assert.equal((await ok("get_story", target)).content.en.blocks[0].content, undefined)
  assert.equal(
    (await ok("get_component", { siteId: siteIds[0], componentId: roots[0] })).fields.length,
    4
  )
  await fail("get_component", { siteId: siteIds[0], componentId: roots[1] }, "NOT_FOUND")
  const operations = [
    { op: "set", path: ["title"], value: "Edited English" },
    {
      op: "set",
      path: ["blocks", { blockId: blocks[0] }, "content", "title"],
      value: "Edited hero"
    }
  ]
  const patch = { ...target, language: "en", expectedRevision: story.revision, operations }
  const forbidden = await rpc(
    "tools/call",
    { name: "patch_story_content", arguments: patch },
    readerToken
  )
  assert.equal(forbidden.status, 403)
  assert.match(forbidden.headers.get("www-authenticate"), /mcp:write/)
  const dry = await ok("patch_story_content", { ...patch, dryRun: true })
  assert.equal(dry.revision, story.revision)
  assert.equal(dry.content.title, "Edited English")
  assert.equal((await ok("get_story", { ...target, full: true })).content.en.title, "English")
  const edit = await ok("patch_story_content", patch)
  assert.notEqual(edit.revision, story.revision)
  await fail("patch_story_content", patch, "CONFLICT")
  story = await ok("get_story", { ...target, full: true })
  assert.equal(story.content.en.blocks[0].content.title, "Edited hero")
  assert.equal(story.content.de.title, "Deutsch")
  const invalid = {
    ...patch,
    expectedRevision: story.revision,
    operations: [
      { op: "set", path: ["title"], value: "Must roll back" },
      { op: "unset", path: ["blocks", { blockId: blocks[0] }, "content", "title"] }
    ]
  }
  await fail("patch_story_content", invalid, "VALIDATION")
  assert.equal((await ok("get_story", { ...target, full: true })).revision, story.revision)
  await fail(
    "patch_story_content",
    {
      ...invalid,
      operations: [{ op: "set", path: ["link"], value: { type: "internal", storyId: ids[1] } }]
    },
    "VALIDATION"
  )
  await fail("patch_story_content", { ...invalid, language: "fr" }, "VALIDATION")
  await fail("patch_story_content", { ...invalid, siteId: siteIds[1] }, "NOT_FOUND")
  const inserted = randomUUID()
  const blockEdit = await ok("patch_story_content", {
    ...patch,
    expectedRevision: story.revision,
    operations: [
      {
        op: "insert_block",
        path: ["blocks"],
        block: { id: inserted, componentId: children[0], content: { title: "Second" } },
        position: "end"
      },
      { op: "move_block", path: ["blocks"], blockId: inserted, position: "start" }
    ]
  })
  assert.equal(blockEdit.content.blocks[0].id, inserted)
  const removed = await ok("patch_story_content", {
    ...patch,
    expectedRevision: blockEdit.revision,
    operations: [{ op: "remove_block", path: ["blocks"], blockId: inserted }]
  })
  assert.equal(removed.content.blocks.length, 1)
  // Catch changes from writers that do not advance updated_at, too.
  await sql(
    "update stories set content=jsonb_set(content,'{en,title}','\"Dashboard edit\"') where id=$1",
    [ids[0]]
  )
  await fail("patch_story_content", { ...patch, expectedRevision: removed.revision }, "CONFLICT")
  const current = await ok("get_story", { ...target, full: true })
  // Concurrent edits based on the same snapshot: exactly one commits.
  const competing = await Promise.all(
    ["Winner A", "Winner B"].map((value) =>
      call("patch_story_content", {
        ...patch,
        expectedRevision: current.revision,
        operations: [{ op: "set", path: ["title"], value }]
      })
    )
  )
  assert.equal(competing.filter((r) => !r.isError).length, 1)
  assert.equal(competing.find((r) => r.isError).structuredContent.error.code, "CONFLICT")
  const validation = await ok("validate_story", { ...target, language: "en" })
  assert.equal(validation.valid, true)
  assert.equal(
    (await ok("validate_story", { ...target, language: "en", content: { title: 3 } })).valid,
    false
  )
  assert.equal(
    (await ok("get_translation_status", { ...target, sourceLanguage: "en" })).locales.length,
    2
  )
  assert.equal(
    (await ok("search_content", { siteId: siteIds[0], query: "Winner" })).pagination.total,
    1
  )
  const assetId = randomUUID()
  await sql(
    "insert into assets(id,file_name,content_type,file_size,type,src,site_id,organisation_id) values($1,'old.png','image/png',12,'image','https://example.test/file.png',$2,$3)",
    [assetId, siteIds[0], workspaces[0].id]
  )
  assert.equal((await ok("list_assets", { siteId: siteIds[0] })).length, 1)
  assert.equal(
    (await ok("update_asset", { siteId: siteIds[0], assetId, fileName: "new.png" })).fileName,
    "new.png"
  )
  await fail("update_asset", { siteId: siteIds[1], assetId, fileName: "stolen.png" }, "NOT_FOUND")
  const second = await ok("get_story", { siteId: siteIds[1], storyId: ids[1], full: true })
  const secondPatch = {
    siteId: siteIds[1],
    storyId: ids[1],
    expectedRevision: second.revision,
    language: "en",
    operations: [
      { op: "set", path: ["image"], value: { id: assetId, src: "https://example.test/file.png" } }
    ]
  }
  await fail("patch_story_content", secondPatch, "VALIDATION")
  await sql(
    "update organisation_members set deleted_at=now() where user_id=$1 and organisation_id=$2",
    [userId, workspaces[1].id]
  )
  await fail("patch_story_content", secondPatch, "NOT_FOUND")
  await fail("create_site", { ...siteInputs[1], id: randomUUID() }, "NOT_FOUND")
  await sql(
    "update organisation_members set deleted_at=null where user_id=$1 and organisation_id=$2",
    [userId, workspaces[1].id]
  )
  await sql("update sites set deleted_at=now() where id=$1", [siteIds[1]])
  await fail("patch_story_content", secondPatch, "NOT_FOUND")
  await sql("update sites set deleted_at=null where id=$1", [siteIds[1]])
  story = await ok("get_story", { ...target, full: true })
  const renamed = await ok("update_story", {
    ...target,
    expectedRevision: story.revision,
    title: "Renamed",
    slug: "renamed"
  })
  assert.equal(renamed.title, "Renamed")
  assert.deepEqual(renamed.content, story.content)
  await fail("delete_story", { ...target, expectedRevision: story.revision }, "CONFLICT")
  await ok("delete_story", { ...target, expectedRevision: renamed.revision })
  await fail("get_story", target, "NOT_FOUND")
  await fail("patch_story_content", { ...patch, expectedRevision: renamed.revision }, "NOT_FOUND")
  assert.ok((await sql("select deleted_at from stories where id=$1", [ids[0]]))[0].deleted_at)
  assert.equal(
    (await ok("get_story", { siteId: siteIds[1], storyId: ids[1], full: true })).content.en.title,
    "English"
  )
  console.log(
    "PASS: OAuth write step-up, parallel workspace creation, scoped references, nested block edits, dry runs, atomic validation, locale preservation, conflict detection, asset rename and soft deletion"
  )
}
