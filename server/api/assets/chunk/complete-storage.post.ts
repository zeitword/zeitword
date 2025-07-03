import { z } from "zod"
import { useS3Storage } from "~~/server/utils/storage"
// @ts-ignore
import { uuidv7 } from "uuidv7"

const completeUploadSchema = z.object({
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  contentType: z.string().min(1),
  totalChunks: z.number().int().positive(),
  chunkIds: z.array(z.string())
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, completeUploadSchema.parse)
  const config = useRuntimeConfig()
  const storage = useS3Storage()
  const finalAssetId = uuidv7()

  try {
    console.log(
      `[Complete-Storage] Processing ${data.totalChunks} chunks for upload ${data.uploadId}`
    )

    // Construct chunk keys
    const chunkKeys = data.chunkIds.map(
      (chunkId, index) => `chunks/${data.uploadId}/${index.toString().padStart(6, "0")}-${chunkId}`
    )

    // Collect all chunk data
    const chunks: Buffer[] = []

    for (const chunkKey of chunkKeys) {
      try {
        console.log(`[Complete-Storage] Getting chunk: ${chunkKey}`)
        // Use storage driver to get chunk
        const chunkData = await storage.getItemRaw(chunkKey)

        if (!chunkData) {
          throw new Error(`Chunk not found: ${chunkKey}`)
        }

        // Convert to buffer
        let buffer: Buffer
        if (chunkData instanceof Buffer) {
          buffer = chunkData
        } else if (chunkData instanceof Blob) {
          const arrayBuffer = await chunkData.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
        } else if (typeof chunkData === "string") {
          buffer = Buffer.from(chunkData)
        } else if (chunkData instanceof ArrayBuffer) {
          buffer = Buffer.from(chunkData)
        } else if (chunkData instanceof Uint8Array) {
          buffer = Buffer.from(chunkData)
        } else {
          console.error(`Unknown chunk data type for ${chunkKey}:`, typeof chunkData, chunkData)
          throw new Error(`Unknown chunk data type for ${chunkKey}: ${typeof chunkData}`)
        }

        chunks.push(buffer)
      } catch (error: any) {
        console.error(`[Complete-Storage] Failed to get chunk ${chunkKey}:`, error.message)
        throw new Error(`Failed to retrieve chunk ${chunkKey}: ${error.message}`)
      }
    }

    // Merge all chunks
    const completeBuffer = Buffer.concat(chunks)
    console.log(
      `[Complete-Storage] Final file size: ${completeBuffer.length} bytes (expected: ${data.fileSize})`
    )

    // Create blob with correct content type
    const blob = new Blob([completeBuffer], { type: data.contentType })

    // Upload complete file using storage driver
    await storage.setItemRaw(finalAssetId, blob, {
      CacheControl: "public, max-age=31536000"
    })

    // Delete chunks
    for (const chunkKey of chunkKeys) {
      try {
        await storage.removeItem(chunkKey)
      } catch (error: any) {
        console.warn(`[Complete-Storage] Failed to delete chunk ${chunkKey}:`, error.message)
      }
    }

    // Return final asset information
    const fileUrl = `${config.s3Endpoint as string}/${config.s3Bucket as string}/${finalAssetId}`
    const fileType = getAssetTypeFromMimeType(data.contentType)

    console.log(`[Complete-Storage] Upload completed successfully: ${fileUrl}`)

    return {
      id: finalAssetId,
      src: fileUrl,
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("[Complete-Storage] Failed to complete chunked upload:", error)
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
