import { z } from "zod"
import { assets } from "~~/server/database/schema"

const completeUploadSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
  contentType: z.string().min(1),
  siteId: z.string().uuid().optional(),
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
    const src = s3.getPublicUrl(data.key)

    // If siteId is provided, persist the asset record in the database
    if (data.siteId) {
      await useDrizzle()
        .insert(assets)
        .values({
          id: data.key,
          fileName: data.fileName,
          contentType: data.contentType,
          fileSize: data.fileSize || 0,
          type: fileType,
          src,
          siteId: data.siteId,
          uploadedBy: secure.userId,
          organisationId: secure.organisationId
        })
    }

    return {
      id: data.key,
      src,
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
