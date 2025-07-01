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

  // Read body as buffer to handle binary data properly
  const body = await readRawBody(event, false) // false = return as Buffer

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "No chunk data provided" })
  }

  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  try {
    // Log chunk size for debugging
    console.log(`Uploading part ${query.partNumber}, size: ${body.length} bytes`)

    const command = new UploadPartCommand({
      Bucket: config.s3Bucket,
      Key: query.fileId,
      UploadId: query.uploadId,
      PartNumber: query.partNumber,
      Body: body // Already a Buffer
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
