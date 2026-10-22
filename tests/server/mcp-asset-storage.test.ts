import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  headItem: vi.fn(),
  putItem: vi.fn(),
  createMultipartUpload: vi.fn(),
  uploadPart: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
  fetchAsset: vi.fn(),
  decodeUpload: vi.fn()
}))
vi.mock("../../server/utils/s3", () => ({ useS3: () => mocks }))
vi.mock("../../server/mcp/asset-source", () => ({
  fetchAsset: mocks.fetchAsset,
  decodeUpload: mocks.decodeUpload,
  IMPORT_TIMEOUT_MS: 600_000
}))
import { persistAsset, assetParts, IMPORT_PART_BYTES } from "../../server/mcp/asset-storage"

const input = { id: "unused", fileName: "image.png", url: "https://cms.example/image" }
beforeEach(() => vi.resetAllMocks())
it("imports source bytes and MIME type into immutable object storage", async () => {
  mocks.headItem.mockRejectedValue({ $metadata: { httpStatusCode: 404 } })
  mocks.fetchAsset.mockResolvedValue({
    body: (async function* () {
      yield Buffer.from("image")
    })(),
    contentType: "image/png",
    close: vi.fn()
  })
  mocks.createMultipartUpload.mockResolvedValue("upload")
  mocks.uploadPart.mockResolvedValue({ ETag: "etag", PartNumber: 1 })
  await expect(persistAsset("key", input)).resolves.toEqual({
    fileSize: 5,
    contentType: "image/png"
  })
  expect(mocks.uploadPart.mock.calls[0]![3]).toEqual(Buffer.from("image"))
  expect(mocks.completeMultipartUpload).toHaveBeenCalledWith(
    "key",
    "upload",
    [{ ETag: "etag", PartNumber: 1 }],
    expect.objectContaining({ ifNoneMatch: "*" })
  )
})
it("streams the largest migration file in bounded parts without reading ahead", async () => {
  const total = 444_391_171
  let read = 0,
    uploaded = 0
  async function* source() {
    const chunk = Buffer.alloc(64 * 1024, 42)
    while (read < total) {
      const size = Math.min(chunk.length, total - read)
      read += size
      yield chunk.subarray(0, size)
    }
  }
  for await (const part of assetParts(source())) {
    expect(part.length).toBeLessThanOrEqual(IMPORT_PART_BYTES)
    expect(read - uploaded).toBeLessThanOrEqual(IMPORT_PART_BYTES + 64 * 1024)
    expect(part[0]).toBe(42)
    uploaded += part.length
  }
  expect(uploaded).toBe(total)
})
it("aborts multipart storage and closes the source after a failed part", async () => {
  mocks.headItem.mockRejectedValue({ $metadata: { httpStatusCode: 404 } })
  const close = vi.fn()
  mocks.fetchAsset.mockResolvedValue({
    body: (async function* () {
      yield Buffer.from("data")
    })(),
    contentType: "video/mp4",
    close
  })
  mocks.createMultipartUpload.mockResolvedValue("upload")
  mocks.uploadPart.mockRejectedValue(new Error("Part failed"))
  await expect(persistAsset("key", input)).rejects.toThrow("Part failed")
  expect(mocks.abortMultipartUpload).toHaveBeenCalledWith("key", "upload")
  expect(mocks.completeMultipartUpload).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalled()
})
it("recovers an already uploaded object without refetching or overwriting bytes", async () => {
  mocks.headItem.mockResolvedValue({ ContentLength: 5, ContentType: "image/png" })
  await expect(persistAsset("key", input)).resolves.toEqual({
    fileSize: 5,
    contentType: "image/png"
  })
  expect(mocks.fetchAsset).not.toHaveBeenCalled()
  expect(mocks.putItem).not.toHaveBeenCalled()
})
it("propagates storage failures rather than treating them as absent objects", async () => {
  mocks.headItem.mockRejectedValue(new Error("Storage unavailable"))
  await expect(persistAsset("key", input)).rejects.toThrow(/Storage unavailable/)
  expect(mocks.fetchAsset).not.toHaveBeenCalled()
})
