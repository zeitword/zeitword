import { z } from "zod"
import {
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand
} from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"
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
  const s3Client = useS3Client()
  const finalAssetId = uuidv7()

  try {
    console.log(
      `[Complete-Direct] Processing ${data.totalChunks} chunks for upload ${data.uploadId}`
    )

    // Construct chunk keys directly from the chunk IDs
    const chunkKeys = data.chunkIds.map(
      (chunkId, index) => `chunks/${data.uploadId}/${index.toString().padStart(6, "0")}-${chunkId}`
    )

    console.log(`[Complete-Direct] Chunk keys:`, chunkKeys.slice(0, 3))

    // Create multipart upload for final file
    const createMultipartCommand = new CreateMultipartUploadCommand({
      Bucket: config.s3Bucket as string,
      Key: finalAssetId,
      ContentType: data.contentType,
      CacheControl: "public, max-age=31536000",
      Metadata: {
        fileName: data.fileName,
        uploadedBy: secure.userId || "unknown"
      }
    })

    const multipartUpload = await s3Client.send(createMultipartCommand)
    const uploadId = multipartUpload.UploadId!

    // Process chunks in batches and upload as parts
    const parts: { ETag: string; PartNumber: number }[] = []
    const MERGE_BATCH_SIZE = 2 // Merge 2 chunks at a time (2.5MB each = 5MB total)
    let partNumber = 1

    for (let i = 0; i < chunkKeys.length; i += MERGE_BATCH_SIZE) {
      const batch = chunkKeys.slice(i, Math.min(i + MERGE_BATCH_SIZE, chunkKeys.length))
      const buffers: Buffer[] = []

      console.log(
        `[Complete-Direct] Processing part ${partNumber}, chunks ${i} to ${Math.min(i + MERGE_BATCH_SIZE - 1, chunkKeys.length - 1)}`
      )

      // Download chunks in this batch
      for (const chunkKey of batch) {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: config.s3Bucket as string,
            Key: chunkKey
          })

          const response = await s3Client.send(getCommand)
          if (response.Body) {
            // Convert stream to buffer
            const chunks: Uint8Array[] = []
            for await (const chunk of response.Body as any) {
              chunks.push(chunk)
            }
            buffers.push(Buffer.concat(chunks))
          }
        } catch (error: any) {
          console.error(`[Complete-Direct] Failed to get chunk ${chunkKey}:`, error.message)
          throw new Error(`Failed to retrieve chunk ${chunkKey}: ${error.message}`)
        }
      }

      // Merge buffers
      const mergedBuffer = Buffer.concat(buffers)
      console.log(`[Complete-Direct] Part ${partNumber} size: ${mergedBuffer.length} bytes`)

      // Upload merged chunk as a part
      const uploadPartCommand = new UploadPartCommand({
        Bucket: config.s3Bucket as string,
        Key: finalAssetId,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: mergedBuffer
      })

      const uploadResponse = await s3Client.send(uploadPartCommand)
      parts.push({
        ETag: uploadResponse.ETag!,
        PartNumber: partNumber
      })

      partNumber++

      // Delete original chunks to save storage
      for (const chunkKey of batch) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: config.s3Bucket as string,
            Key: chunkKey
          })
          await s3Client.send(deleteCommand)
        } catch (error: any) {
          console.warn(`[Complete-Direct] Failed to delete chunk ${chunkKey}:`, error.message)
        }
      }

      // Clear buffers from memory
      buffers.length = 0
    }

    // Complete multipart upload
    console.log(`[Complete-Direct] Completing multipart upload with ${parts.length} parts`)
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: config.s3Bucket as string,
      Key: finalAssetId,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    })

    await s3Client.send(completeCommand)

    // Return final asset information
    const fileUrl = `${config.s3Endpoint as string}/${config.s3Bucket as string}/${finalAssetId}`
    const fileType = getAssetTypeFromMimeType(data.contentType)

    console.log(`[Complete-Direct] Upload completed successfully: ${fileUrl}`)

    return {
      id: finalAssetId,
      src: fileUrl,
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("[Complete-Direct] Failed to complete chunked upload:", error)
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
