import { z } from "zod"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { useS3Client } from "~~/server/utils/s3-client"
// @ts-ignore
import { uuidv7 } from "uuidv7"

const bodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const config = useRuntimeConfig()
  const s3Client = useS3Client()
  const assetId = uuidv7()

  try {
    // Create the put object command
    const command = new PutObjectCommand({
      Bucket: config.s3Bucket as string,
      Key: assetId,
      ContentType: data.contentType,
      ContentLength: data.fileSize,
      CacheControl: "public, max-age=31536000",
      Metadata: {
        fileName: data.fileName,
        uploadedBy: secure.userId || "unknown"
      }
    })

    // Generate pre-signed URL valid for 5 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })

    const fileUrl = `${config.s3Endpoint as string}/${config.s3Bucket as string}/${assetId}`
    const fileType = getAssetTypeFromMimeType(data.contentType)

    return {
      uploadUrl: presignedUrl,
      assetId,
      assetUrl: fileUrl,
      assetType: fileType
    }
  } catch (error) {
    console.error("Failed to generate pre-signed URL:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to generate upload URL" })
  }
})

function getAssetTypeFromMimeType(mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return "image"
  } else if (mimeType.startsWith("video/")) {
    return "video"
  } else if (mimeType.startsWith("audio/")) {
    return "audio"
  } else if (mimeType === "application/pdf") {
    return "pdf"
  } else {
    return "other"
  }
}
