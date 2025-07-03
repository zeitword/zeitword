import { ListObjectsV2Command } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const query = getQuery(event)
  const uploadId = query.uploadId as string

  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  try {
    // First, list without prefix to see all objects
    const allCommand = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      MaxKeys: 100
    })

    const allResponse = await s3Client.send(allCommand)
    const allObjects = allResponse.Contents || []

    // Then list with specific prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      Prefix: uploadId ? `chunks/${uploadId}/` : "chunks/",
      MaxKeys: 1000
    })

    const listResponse = await s3Client.send(listCommand)
    const objects = listResponse.Contents || []

    return {
      bucket: config.s3Bucket,
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      prefix: uploadId ? `chunks/${uploadId}/` : "chunks/",
      count: objects.length,
      totalObjectsInBucket: allObjects.length,
      sampleKeys: allObjects.slice(0, 10).map((obj) => obj.Key),
      matchingObjects: objects.map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified
      }))
    }
  } catch (error) {
    console.error("Failed to list chunks:", error)
    throw createError({ statusCode: 500, statusMessage: "Failed to list chunks" })
  }
})
