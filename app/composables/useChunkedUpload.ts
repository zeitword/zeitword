import { ref, computed } from "vue"

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface ChunkedUploadOptions {
  chunkSize?: number // Default 4MB to stay under 5MB limit
  maxRetries?: number
  onProgress?: (progress: UploadProgress) => void
  onError?: (error: Error) => void
}

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
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
  const currentFileId = ref<string | null>(null)

  async function uploadFile(file: File) {
    isUploading.value = true
    uploadProgress.value = { loaded: 0, total: file.size, percentage: 0 }

    try {
      // Step 1: Initiate multipart upload
      const initResponse = await $fetch<{
        fileId: string
        uploadId: string
        fileName: string
        contentType: string
        fileSize: number
      }>("/api/assets/multipart/initiate", {
        method: "POST",
        body: {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size
        }
      })

      currentUploadId.value = initResponse.uploadId
      currentFileId.value = initResponse.fileId

      // Step 2: Upload chunks
      const totalChunks = Math.ceil(file.size / chunkSize)
      const parts: Array<{ ETag: string; PartNumber: number }> = []

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        const partNumber = i + 1

        let retries = 0
        let uploaded = false

        while (!uploaded && retries < maxRetries) {
          try {
            const partResponse = await uploadChunk(
              chunk,
              initResponse.fileId,
              initResponse.uploadId,
              partNumber
            )

            parts.push({
              ETag: partResponse.ETag,
              PartNumber: partResponse.PartNumber
            })

            uploaded = true

            // Update progress
            uploadProgress.value.loaded = end
            uploadProgress.value.percentage = Math.round((end / file.size) * 100)
            onProgress?.(uploadProgress.value)
          } catch (error) {
            retries++
            if (retries >= maxRetries) {
              throw new Error(`Failed to upload chunk ${partNumber} after ${maxRetries} retries`)
            }
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
          }
        }
      }

      // Step 3: Complete multipart upload
      const completeResponse = await $fetch<{
        id: string
        src: string
        type: string
        fileName: string
      }>("/api/assets/multipart/complete", {
        method: "POST",
        body: {
          fileId: initResponse.fileId,
          uploadId: initResponse.uploadId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          parts
        }
      })

      isUploading.value = false
      currentUploadId.value = null
      currentFileId.value = null

      return completeResponse
    } catch (error) {
      isUploading.value = false

      // Try to abort the upload if it failed
      if (currentUploadId.value && currentFileId.value) {
        try {
          await abortUpload()
        } catch (abortError) {
          console.error("Failed to abort upload:", abortError)
        }
      }

      const err = error instanceof Error ? error : new Error("Upload failed")
      onError?.(err)
      throw err
    }
  }

  async function uploadChunk(chunk: Blob, fileId: string, uploadId: string, partNumber: number) {
    const response = await $fetch<{
      ETag: string
      PartNumber: number
    }>(`/api/assets/multipart/upload-part`, {
      method: "POST",
      query: {
        fileId,
        uploadId,
        partNumber
      },
      body: chunk,
      // Ensure binary data is sent properly
      headers: {
        "Content-Type": "application/octet-stream"
      }
    })

    return response
  }

  async function abortUpload() {
    if (!currentUploadId.value || !currentFileId.value) return

    await $fetch("/api/assets/multipart/abort", {
      method: "POST",
      body: {
        fileId: currentFileId.value,
        uploadId: currentUploadId.value
      }
    })

    currentUploadId.value = null
    currentFileId.value = null
  }

  return {
    uploadFile,
    abortUpload,
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value)
  }
}
