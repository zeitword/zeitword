import { useS3 } from "../utils/s3"
import { decodeUpload, fetchAsset } from "./asset-source"

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
  const source =
    input.url !== undefined
      ? await fetchAsset(input.url)
      : { body: decodeUpload(input.base64!), contentType: input.contentType! }
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
