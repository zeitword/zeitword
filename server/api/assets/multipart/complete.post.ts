import { z } from "zod"
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

const bodySchema = z.object({
  fileId: z.string().min(1),
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  parts: z.array(
    z.object({
      ETag: z.string(),
      PartNumber: z.number()
    })
  )
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: data.fileId,
      UploadId: data.uploadId,
      MultipartUpload: {
        Parts: data.parts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    })

    await s3Client.send(command)

    const fileUrl = config.s3Endpoint + "/" + config.s3Bucket + "/" + data.fileId
    const fileType = getAssetTypeFromMimeType(data.contentType)

    return {
      id: data.fileId,
      src: fileUrl,
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("Failed to complete multipart upload:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to complete upload" })
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
