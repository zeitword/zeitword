import { z } from "zod"
import { useS3Storage } from "~~/server/utils/storage"

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

    const storage = useS3Storage()

    // Store chunk with storage driver
    const chunkKey = `chunks/${metadata.uploadId}/${metadata.chunkIndex.toString().padStart(6, "0")}-${metadata.chunkId}`
    const arrayBuffer = await chunk.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: "application/octet-stream" })

    await storage.setItemRaw(chunkKey, blob)

    console.log(
      `[Storage] Successfully uploaded chunk ${metadata.chunkIndex} with key: ${chunkKey}`
    )

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
