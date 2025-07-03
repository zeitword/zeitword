import { z } from "zod"
import {
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand
} from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"
import { uuidv7 } from "uuidv7"

const completeUploadSchema = z.object({
  uploadId: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.coerce.number().int().positive(),
  contentType: z.string().min(1),
  totalChunks: z.coerce.number().int().positive(),
  chunkIds: z.array(z.string())
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const data = await readValidatedBody(event, completeUploadSchema.parse)
  const config = useRuntimeConfig()
  const s3Client = useS3Client()
  const finalAssetId = uuidv7()

  // Remove delay since chunks are confirmed to be in S3
  // await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    // Step 1: List all chunks for this upload
    const listCommand = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      Prefix: `chunks/${data.uploadId}/`,
      MaxKeys: 1000
    })

    // Retry logic for S3 eventual consistency
    let chunks: any[] = []
    let retries = 0
    const maxRetries = 10

    while (retries < maxRetries) {
      console.log(`[Attempt ${retries + 1}] Listing chunks with prefix: chunks/${data.uploadId}/`)
      console.log(`Bucket: ${config.s3Bucket}`)
      const listResponse = await s3Client.send(listCommand)
      chunks = listResponse.Contents || []

      console.log(`[Attempt ${retries + 1}] Found ${chunks.length} chunks`)
      console.log(
        `IsTruncated: ${listResponse.IsTruncated}, NextContinuationToken: ${listResponse.NextContinuationToken}`
      )
      if (chunks.length > 0) {
        console.log(
          `First few chunk keys:`,
          chunks.slice(0, 3).map((c) => c.Key)
        )
      }

      // If response is truncated, we need to get all pages
      if (listResponse.IsTruncated && chunks.length < data.totalChunks) {
        console.log("Response was truncated, fetching all chunks...")
        const allChunks = [...chunks]
        let continuationToken = listResponse.NextContinuationToken

        while (continuationToken) {
          const nextCommand = new ListObjectsV2Command({
            Bucket: config.s3Bucket as string,
            Prefix: `chunks/${data.uploadId}/`,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
          })

          const nextResponse = await s3Client.send(nextCommand)
          const nextChunks = nextResponse.Contents || []
          allChunks.push(...nextChunks)
          continuationToken = nextResponse.NextContinuationToken

          console.log(`Fetched ${nextChunks.length} more chunks, total: ${allChunks.length}`)
        }

        chunks = allChunks
      }
      if (chunks.length === data.totalChunks) {
        break
      }

      if (retries < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retries), 10000)
        console.log(`Waiting ${delay}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      retries++
    }

    if (chunks.length !== data.totalChunks) {
      // List all objects to debug
      const debugListCommand = new ListObjectsV2Command({
        Bucket: config.s3Bucket as string,
        Prefix: `chunks/`,
        MaxKeys: 100
      })
      const debugResponse = await s3Client.send(debugListCommand)
      console.log(`All chunks in bucket:`, debugResponse.Contents?.map((c) => c.Key) || [])

      throw new Error(
        `Expected ${data.totalChunks} chunks but found ${chunks.length} after ${maxRetries} attempts`
      )
    }

    // Sort chunks by index
    chunks.sort((a, b) => {
      const aIndex = parseInt(a.Key!.split("/").pop()!.split("-")[0])
      const bIndex = parseInt(b.Key!.split("/").pop()!.split("-")[0])
      return aIndex - bIndex
    })

    // Step 2: Create multipart upload for final file
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

    // Step 3: Process chunks in batches and upload as parts
    const parts: { ETag: string; PartNumber: number }[] = []
    const MERGE_BATCH_SIZE = 2 // Merge 2 chunks at a time (2.5MB each = 5MB total)
    let partNumber = 1

    for (let i = 0; i < chunks.length; i += MERGE_BATCH_SIZE) {
      const batch = chunks.slice(i, Math.min(i + MERGE_BATCH_SIZE, chunks.length))
      const buffers: Buffer[] = []

      // Download chunks in this batch
      for (const chunk of batch) {
        const getCommand = new GetObjectCommand({
          Bucket: config.s3Bucket as string,
          Key: chunk.Key!
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
      }

      // Merge buffers
      const mergedBuffer = Buffer.concat(buffers)

      // S3 requires minimum 5MB for multipart upload parts (except last part)
      // Log the size for debugging
      console.log(`Part ${partNumber} size: ${mergedBuffer.length} bytes`)

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
      for (const chunk of batch) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: config.s3Bucket as string,
          Key: chunk.Key!
        })
        await s3Client.send(deleteCommand)
      }

      // Clear buffers from memory
      buffers.length = 0
    }

    // Step 4: Complete multipart upload
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

    return {
      id: finalAssetId,
      src: fileUrl,
      type: fileType,
      fileName: data.fileName
    }
  } catch (error) {
    console.error("Failed to complete chunked upload:", error)

    // Clean up any remaining chunks on error
    try {
      const cleanupList = new ListObjectsV2Command({
        Bucket: config.s3Bucket as string,
        Prefix: `chunks/${data.uploadId}/`
      })
      const cleanupResponse = await s3Client.send(cleanupList)

      if (cleanupResponse.Contents) {
        for (const obj of cleanupResponse.Contents) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: config.s3Bucket as string,
              Key: obj.Key!
            })
          )
        }
      }

      // Also clean up intermediate chunks if any
      const intermediateList = new ListObjectsV2Command({
        Bucket: config.s3Bucket as string,
        Prefix: `intermediate/${data.uploadId}/`
      })
      const intermediateResponse = await s3Client.send(intermediateList)

      if (intermediateResponse.Contents) {
        for (const obj of intermediateResponse.Contents) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: config.s3Bucket as string,
              Key: obj.Key!
            })
          )
        }
      }
    } catch (cleanupError) {
      console.error("Failed to clean up chunks:", cleanupError)
    }

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
