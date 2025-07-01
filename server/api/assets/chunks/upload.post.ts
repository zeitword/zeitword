import { z } from "zod"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

const querySchema = z.object({
  uploadId: z.string().min(1),
  chunkIndex: z.coerce.number().int().min(0)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const query = await getValidatedQuery(event, querySchema.parse)

  // Read body as buffer to handle binary data properly
  const body = await readRawBody(event, false) // false = return as Buffer

  if (!body || body.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No chunk data provided" })
  }

  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  // Store chunk as temporary S3 object
  const chunkKey = `temp-chunks/${query.uploadId}/chunk-${query.chunkIndex}`

  try {
    console.log(
      `Uploading chunk ${query.chunkIndex} for upload ${query.uploadId}, size: ${body.length} bytes`
    )

    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: chunkKey,
      Body: body,
      ContentType: "application/octet-stream",
      // Add metadata to track this is a temporary chunk
      Metadata: {
        uploadId: query.uploadId,
        chunkIndex: query.chunkIndex.toString()
      }
    })

    await s3Client.send(command)

    return {
      chunkKey,
      chunkIndex: query.chunkIndex,
      size: body.length
    }
  } catch (error) {
    console.error("Failed to upload chunk:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to upload chunk" })
  }
})
