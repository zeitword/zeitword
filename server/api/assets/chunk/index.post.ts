import { z } from "zod"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

const chunkMetadataSchema = z.object({
  chunkId: z.string().min(1),
  chunkIndex: z.coerce.number().int().nonnegative(),
  uploadId: z.string().min(1),
  totalChunks: z.coerce.number().int().positive(),
  fileName: z.string().min(1),
  fileSize: z.coerce.number().int().positive(),
  contentType: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  try {
    const formData = await readFormData(event)
    const chunk = formData.get("chunk") as File
    if (!chunk) throw createError({ statusCode: 400, statusMessage: "No chunk provided" })

    // Parse and validate metadata
    const metadata = chunkMetadataSchema.parse({
      chunkId: formData.get("chunkId"),
      chunkIndex: formData.get("chunkIndex"),
      uploadId: formData.get("uploadId"),
      totalChunks: formData.get("totalChunks"),
      fileName: formData.get("fileName"),
      fileSize: formData.get("fileSize"),
      contentType: formData.get("contentType")
    })

    const config = useRuntimeConfig()
    const s3Client = useS3Client()

    // Store chunk with metadata
    const chunkKey = `chunks/${metadata.uploadId}/${metadata.chunkIndex.toString().padStart(6, "0")}-${metadata.chunkId}`
    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const command = new PutObjectCommand({
      Bucket: config.s3Bucket as string,
      Key: chunkKey,
      Body: buffer,
      ContentType: "application/octet-stream",
      Metadata: {
        uploadId: metadata.uploadId,
        chunkIndex: metadata.chunkIndex.toString(),
        chunkId: metadata.chunkId,
        totalChunks: metadata.totalChunks.toString(),
        fileName: metadata.fileName,
        fileSize: metadata.fileSize.toString(),
        originalContentType: metadata.contentType,
        uploadedBy: secure.userId || "unknown"
      }
    })

    await s3Client.send(command)

    console.log(`Successfully uploaded chunk ${metadata.chunkIndex} with key: ${chunkKey}`)

    return {
      chunkId: metadata.chunkId,
      index: metadata.chunkIndex,
      size: chunk.size
    }
  } catch (error) {
    console.error("Failed to upload chunk:", error)
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: "Invalid chunk metadata" })
    }
    throw createError({ statusCode: 500, statusMessage: "Failed to upload chunk" })
  }
})
