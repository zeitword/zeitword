import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  headItem: vi.fn(),
  putItem: vi.fn(),
  fetchAsset: vi.fn(),
  decodeUpload: vi.fn()
}))
vi.mock("../../server/utils/s3", () => ({ useS3: () => mocks }))
vi.mock("../../server/mcp/asset-source", () => ({
  fetchAsset: mocks.fetchAsset,
  decodeUpload: mocks.decodeUpload
}))
import { persistAsset } from "../../server/mcp/asset-storage"

const input = { id: "unused", fileName: "image.png", url: "https://cms.example/image" }
beforeEach(() => vi.resetAllMocks())
it("imports source bytes and MIME type into immutable object storage", async () => {
  mocks.headItem.mockRejectedValue({ $metadata: { httpStatusCode: 404 } })
  mocks.fetchAsset.mockResolvedValue({ body: Buffer.from("image"), contentType: "image/png" })
  await expect(persistAsset("key", input)).resolves.toEqual({
    fileSize: 5,
    contentType: "image/png"
  })
  expect(mocks.putItem).toHaveBeenCalledWith(
    "key",
    Buffer.from("image"),
    expect.objectContaining({ contentType: "image/png", ifNoneMatch: "*" })
  )
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
