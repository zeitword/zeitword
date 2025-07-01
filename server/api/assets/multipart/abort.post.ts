import { z } from "zod"
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

const bodySchema = z.object({
  fileId: z.string().min(1),
  uploadId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: data.fileId,
      UploadId: data.uploadId
    })

    await s3Client.send(command)

    return { success: true }
  } catch (error) {
    console.error("Failed to abort multipart upload:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to abort upload" })
  }
})
