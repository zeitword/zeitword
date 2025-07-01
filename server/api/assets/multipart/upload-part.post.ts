import { z } from "zod"
import { UploadPartCommand } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

const querySchema = z.object({
  fileId: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const query = await getValidatedQuery(event, querySchema.parse)
  const body = await readRawBody(event)

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "No chunk data provided" })
  }
  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  try {
    const command = new UploadPartCommand({
      Bucket: config.s3Bucket,
      Key: query.fileId,
      UploadId: query.uploadId,
      PartNumber: query.partNumber,
      Body: Buffer.from(body)
    })

    const response = await s3Client.send(command)

    return {
      ETag: response.ETag,
      PartNumber: query.partNumber
    }
  } catch (error) {
    console.error("Failed to upload part:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to upload chunk" })
  }
})
