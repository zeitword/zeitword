import { useS3 } from "../utils/s3"
import { decodeUpload, fetchAsset, IMPORT_TIMEOUT_MS } from "./asset-source"

export const IMPORT_PART_BYTES = 8 * 1024 * 1024

// Sequential multipart uploads apply backpressure to the source and retain only
// one fixed-size part, rather than buffering the complete video in memory.
export async function* assetParts(source: AsyncIterable<Buffer>) {
  let part = Buffer.allocUnsafe(IMPORT_PART_BYTES),
    used = 0
  for await (const chunk of source) {
    let offset = 0
    while (offset < chunk.length) {
      const size = Math.min(part.length - used, chunk.length - offset)
      chunk.copy(part, used, offset, offset + size)
      used += size
      offset += size
      if (used === part.length) {
        yield part
        part = Buffer.allocUnsafe(IMPORT_PART_BYTES)
        used = 0
      }
    }
  }
  if (used) yield part.subarray(0, used)
}

export type AssetInput = {
  id: string
  fileName: string
  contentType?: string
  url?: string
  base64?: string
}

export async function persistAsset(key: string, input: AssetInput) {
  const s3 = useS3()
  const read = async () => {
    const head = await s3.headItem(key)
    if (!head.ContentLength || !head.ContentType)
      throw new Error("Stored asset metadata is incomplete")
    return { fileSize: head.ContentLength, contentType: head.ContentType }
  }
  // A prior attempt may have uploaded successfully before its DB transaction failed.
  try {
    return await read()
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode !== 404) throw error
  }
  if (input.url !== undefined) {
    const signal = AbortSignal.timeout(IMPORT_TIMEOUT_MS)
    const source = await fetchAsset(input.url, signal)
    const contentType = input.contentType ?? source.contentType
    let uploadId: string | undefined
    try {
      uploadId = await s3.createMultipartUpload(key, {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { fileName: encodeURIComponent(input.fileName) },
        abortSignal: signal
      })
      const parts = []
      let fileSize = 0
      for await (const part of assetParts(source.body)) {
        signal.throwIfAborted()
        parts.push(await s3.uploadPart(key, uploadId, parts.length + 1, part, signal))
        fileSize += part.length
      }
      await s3.completeMultipartUpload(key, uploadId, parts, {
        ifNoneMatch: "*",
        abortSignal: signal
      })
      return { fileSize, contentType }
    } catch (error: any) {
      if (uploadId) {
        try {
          await s3.abortMultipartUpload(key, uploadId)
        } catch (cleanupError) {
          console.error("MCP multipart cleanup failed", cleanupError)
        }
      }
      if (error.$metadata?.httpStatusCode === 412) return read()
      throw error
    } finally {
      source.close()
    }
  }
  const source = { body: decodeUpload(input.base64!), contentType: input.contentType! }
  const contentType = input.contentType ?? source.contentType
  try {
    await s3.putItem(key, source.body, {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { fileName: encodeURIComponent(input.fileName) },
      ifNoneMatch: "*",
      abortSignal: AbortSignal.timeout(60_000)
    })
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 412) return read()
    throw error
  }
  return { fileSize: source.body.length, contentType }
}
