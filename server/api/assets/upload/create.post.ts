import { uuidv7 } from "uuidv7"
import { z } from "zod"

const PART_SIZE = 10 * 1024 * 1024 // 10MB per part

const createUploadSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  contentType: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { userId, organisationId } = await requireAuth(event)

  const data = await readValidatedBody(event, createUploadSchema.parse)
  const s3 = useS3()
  const key = uuidv7()

  const totalParts = Math.ceil(data.fileSize / PART_SIZE)

  try {
    const uploadId = await s3.createMultipartUpload(key, {
      contentType: data.contentType,
      cacheControl: "public, max-age=31536000",
      metadata: {
        fileName: encodeURIComponent(data.fileName),
        uploadedBy: userId || "unknown"
      }
    })

    const presignedUrls = await s3.getPresignedUploadUrls(key, uploadId, totalParts)

    return {
      key,
      uploadId,
      partSize: PART_SIZE,
      totalParts,
      urls: presignedUrls
    }
  } catch (error) {
    console.error("[upload/create] Failed to create multipart upload:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to create upload" })
  }
})
