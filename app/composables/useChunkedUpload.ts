import { ref, computed } from "vue"
import { uuidv7 } from "uuidv7"

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface ChunkedUploadOptions {
  chunkSize?: number
  maxRetries?: number
  onProgress?: (progress: UploadProgress) => void
  onError?: (error: Error) => void
}

// Use 2.5MB chunks to stay well under Vercel's 4.5MB limit
// This allows us to combine 2 chunks into 5MB parts for S3
const DEFAULT_CHUNK_SIZE = 2.5 * 1024 * 1024 // 2.5MB
const DEFAULT_MAX_RETRIES = 3

export function useChunkedUpload(options: ChunkedUploadOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = DEFAULT_MAX_RETRIES,
    onProgress,
    onError
  } = options

  const isUploading = ref(false)
  const uploadProgress = ref<UploadProgress>({ loaded: 0, total: 0, percentage: 0 })
  const currentUploadId = ref<string | null>(null)

  async function uploadFile(file: File) {
    isUploading.value = true
    uploadProgress.value = { loaded: 0, total: file.size, percentage: 0 }

    // Generate unique upload ID for this session
    const uploadId = uuidv7()
    currentUploadId.value = uploadId

    try {
      // Step 1: Upload all chunks as temporary S3 objects
      const totalChunks = Math.ceil(file.size / chunkSize)
      console.log(
        `Uploading ${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(1)}MB each`
      )

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        let retries = 0
        let uploaded = false

        while (!uploaded && retries < maxRetries) {
          try {
            await $fetch("/api/assets/chunks/upload", {
              method: "POST",
              query: {
                uploadId,
                chunkIndex: i
              },
              body: chunk,
              headers: {
                "Content-Type": "application/octet-stream"
              }
            })

            uploaded = true

            // Update progress
            uploadProgress.value.loaded = end
            uploadProgress.value.percentage = Math.round((end / file.size) * 100)
            onProgress?.(uploadProgress.value)
          } catch (error) {
            retries++
            if (retries >= maxRetries) {
              throw new Error(`Failed to upload chunk ${i} after ${maxRetries} retries`)
            }
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
          }
        }
      }

      // Step 2: Combine chunks on S3
      console.log("All chunks uploaded, combining into final file...")

      const completeResponse = await $fetch<{
        id: string
        src: string
        type: string
        fileName: string
      }>("/api/assets/chunks/combine", {
        method: "POST",
        body: {
          uploadId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          totalChunks,
          chunkSize
        }
      })

      isUploading.value = false
      currentUploadId.value = null

      return completeResponse
    } catch (error) {
      isUploading.value = false
      currentUploadId.value = null

      const err = error instanceof Error ? error : new Error("Upload failed")
      onError?.(err)
      throw err
    }
  }

  async function abortUpload() {
    if (!currentUploadId.value) return

    // In the two-stage approach, we'd need to clean up temporary chunks
    // This could be implemented as a separate endpoint
    console.log("Aborting upload:", currentUploadId.value)
    currentUploadId.value = null
  }

  return {
    uploadFile,
    abortUpload,
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value)
  }
}
