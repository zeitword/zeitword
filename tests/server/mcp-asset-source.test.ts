import { EventEmitter } from "node:events"
import { Readable } from "node:stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }))
vi.mock("node:http", () => ({ request: mocks.request }))
vi.mock("node:https", () => ({ request: mocks.request }))
import {
  decodeUpload,
  fetchAsset,
  isPublicAddress,
  MAX_IMPORT_BYTES
} from "../../server/mcp/asset-source"

function respond(
  statusCode: number,
  headers: Record<string, string>,
  chunks = [Buffer.from("image")]
) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void }
    request.end = () => {
      const response = Object.assign(Readable.from(chunks), { statusCode, headers })
      callback(response)
    }
    return request
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
})
describe("asset URL transport", () => {
  it("pins a public DNS answer to the actual socket and reads bytes", async () => {
    respond(200, { "content-type": "image/png; charset=binary" })
    const result = await fetchAsset("https://cms.example/assets/image")
    expect(result).toEqual({ body: Buffer.from("image"), contentType: "image/png" })
    const options = mocks.request.mock.calls[0]![1]
    const callback = vi.fn()
    options.lookup("cms.example", { all: true }, callback)
    expect(callback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }])
    expect(options.headers).toEqual({ "Accept-Encoding": "identity" })
  })
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.168.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2002:7f00:1::",
    "2001:db8::1"
  ])("rejects reserved address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
  it("accepts public IPv6", () => expect(isPublicAddress("2606:4700:4700::1111")).toBe(true))
  it("rejects private and mixed DNS answers before opening a connection", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 }
    ])
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/public internet/)
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it("rechecks redirect destinations and blocks metadata endpoints", async () => {
    respond(302, { location: "http://169.254.169.254/latest/meta-data/" })
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/public internet/)
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it("follows public redirects with fresh DNS checks", async () => {
    respond(302, { location: "https://cdn.example/image" })
    respond(200, { "content-type": "image/jpeg" })
    expect((await fetchAsset("https://cms.example/image")).contentType).toBe("image/jpeg")
    expect(mocks.lookup).toHaveBeenCalledTimes(2)
  })
  it.each(["file:///etc/passwd", "https://user:password@cms.example/image"])(
    "rejects unsupported or credential-bearing URL %s",
    async (url) => {
      await expect(fetchAsset(url)).rejects.toThrow(/public HTTP/)
      expect(mocks.request).not.toHaveBeenCalled()
    }
  )
  it("enforces declared and streamed size limits", async () => {
    respond(200, { "content-length": String(MAX_IMPORT_BYTES + 1) })
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/50 MiB/)
    respond(200, {}, [Buffer.alloc(MAX_IMPORT_BYTES / 2 + 1), Buffer.alloc(MAX_IMPORT_BYTES / 2)])
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/50 MiB/)
  })
  it("rejects error pages, encoded and empty bodies", async () => {
    respond(404, {})
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/HTTP 200/)
    respond(200, { "content-encoding": "gzip" })
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/uncompressed/)
    respond(200, {}, [])
    await expect(fetchAsset("https://cms.example/image")).rejects.toThrow(/empty body/)
  })
  it("validates base64 bytes", () => {
    expect(decodeUpload("aGVsbG8=").toString()).toBe("hello")
    expect(() => decodeUpload("!!!!")).toThrow(/base64/)
    expect(() => decodeUpload("")).toThrow(/1 byte/)
  })
})
