import { z } from "zod"
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3"
import { uuidv7 } from "uuidv7"
import { useS3Client } from "~~/server/utils/s3-client"

const bodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const config = useRuntimeConfig()
  const s3Client = useS3Client()
  const fileId = uuidv7()

  try {
    const command = new CreateMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: fileId,
      ContentType: data.contentType,
      CacheControl: "public, max-age=31536000"
    })

    const response = await s3Client.send(command)

    return {
      fileId,
      uploadId: response.UploadId,
      fileName: data.fileName,
      contentType: data.contentType,
      fileSize: data.fileSize
    }
  } catch (error) {
    console.error("Failed to initiate multipart upload:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to initiate upload" })
  }
})
