import { z } from "zod"

const completeUploadSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1)
      })
    )
    .min(1)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, completeUploadSchema.parse)
  const s3 = useS3()

  try {
    const parts = data.parts
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag
      }))

    await s3.completeMultipartUpload(data.key, data.uploadId, parts)

    const fileType = getAssetTypeFromMimeType(data.contentType)

    return {
      id: data.key,
      src: s3.getPublicUrl(data.key),
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("[upload/complete] Failed to complete multipart upload:", error)

    // Attempt to abort the multipart upload so orphaned parts get cleaned up
    try {
      await s3.abortMultipartUpload(data.key, data.uploadId)
    } catch (abortError) {
      console.error("[upload/complete] Failed to abort multipart upload:", abortError)
    }

    throw createError({ statusCode: 500, statusMessage: "Failed to complete upload" })
  }
})

function getAssetTypeFromMimeType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf") return "pdf"
  return "other"
}
