import { z } from "zod"
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"
import { uuidv7 } from "uuidv7"

const bodySchema = z.object({
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  totalChunks: z.number().int().positive(),
  chunkSize: z.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const config = useRuntimeConfig()
  const s3Client = useS3Client()
  const finalFileId = uuidv7()

  try {
    // Step 1: Create multipart upload for final file
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: finalFileId,
      ContentType: data.contentType,
      CacheControl: "public, max-age=31536000"
    })

    const { UploadId } = await s3Client.send(createCommand)
    if (!UploadId) throw new Error("Failed to create multipart upload")

    console.log(`Combining ${data.totalChunks} chunks into file ${finalFileId}`)

    // Step 2: Download chunks in pairs and upload as 5MB parts
    const parts: Array<{ ETag: string; PartNumber: number }> = []
    let partNumber = 1
    let chunkIndex = 0

    while (chunkIndex < data.totalChunks) {
      // Determine how many chunks to combine for this part
      const remainingChunks = data.totalChunks - chunkIndex
      let chunksToMerge: number

      if (remainingChunks === 1) {
        // Last chunk - upload as is (S3 allows last part to be < 5MB)
        chunksToMerge = 1
      } else if (remainingChunks === 2 || remainingChunks >= 3) {
        // Combine 2 chunks to make a 5MB part
        chunksToMerge = 2
      } else {
        // This shouldn't happen with proper chunking
        chunksToMerge = remainingChunks
      }

      // Download and combine chunks
      const buffers: Buffer[] = []

      for (let i = 0; i < chunksToMerge; i++) {
        const chunkKey = `temp-chunks/${data.uploadId}/chunk-${chunkIndex + i}`

        const getCommand = new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: chunkKey
        })

        const response = await s3Client.send(getCommand)

        if (!response.Body) {
          throw new Error(`Failed to download chunk ${chunkIndex + i}`)
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = []
        for await (const chunk of response.Body as any) {
          chunks.push(chunk)
        }
        buffers.push(Buffer.concat(chunks))
      }

      // Combine buffers
      const combinedBuffer = Buffer.concat(buffers)
      console.log(
        `Part ${partNumber}: Combined ${chunksToMerge} chunks, size: ${combinedBuffer.length} bytes`
      )

      // Upload as multipart part
      const uploadCommand = new UploadPartCommand({
        Bucket: config.s3Bucket,
        Key: finalFileId,
        UploadId,
        PartNumber: partNumber,
        Body: combinedBuffer
      })

      const { ETag } = await s3Client.send(uploadCommand)
      if (ETag) {
        parts.push({ ETag, PartNumber: partNumber })
      }

      chunkIndex += chunksToMerge
      partNumber++
    }

    // Step 3: Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: finalFileId,
      UploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    })

    const result = await s3Client.send(completeCommand)
    console.log(`Upload completed: ${result.Location || finalFileId}`)

    // Step 4: Clean up temporary chunks
    const listCommand = new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      Prefix: `temp-chunks/${data.uploadId}/`
    })

    const { Contents } = await s3Client.send(listCommand)

    if (Contents && Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: config.s3Bucket,
        Delete: {
          Objects: Contents.map((obj) => ({ Key: obj.Key }))
        }
      })

      await s3Client.send(deleteCommand)
      console.log(`Cleaned up ${Contents.length} temporary chunks`)
    }

    const fileUrl = result.Location || `${config.s3Endpoint}/${config.s3Bucket}/${finalFileId}`
    const fileType = getAssetTypeFromMimeType(data.contentType)

    return {
      id: finalFileId,
      src: fileUrl,
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("Failed to combine chunks:", error)

    // Try to clean up on error
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: config.s3Bucket,
        Prefix: `temp-chunks/${data.uploadId}/`
      })

      const { Contents } = await s3Client.send(listCommand)

      if (Contents && Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: config.s3Bucket,
          Delete: {
            Objects: Contents.map((obj) => ({ Key: obj.Key }))
          }
        })

        await s3Client.send(deleteCommand)
      }
    } catch (cleanupError) {
      console.error("Failed to clean up chunks:", cleanupError)
    }

    throw createError({ statusCode: 500, statusMessage: "Failed to combine chunks" })
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
