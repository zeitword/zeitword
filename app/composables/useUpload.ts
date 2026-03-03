import { ref, computed } from "vue"

export interface UploadProgress {
  totalParts: number
  uploadedParts: number
  currentPartProgress: number
  overallProgress: number
  bytesUploaded: number
  totalBytes: number
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onPartComplete?: (partNumber: number) => void
  onError?: (error: Error) => void
  maxRetries?: number
}

interface CreateUploadResponse {
  key: string
  uploadId: string
  partSize: number
  totalParts: number
  urls: { partNumber: number; url: string }[]
}

interface CompleteUploadResponse {
  id: string
  src: string
  type: string
  fileName: string
}

export function useUpload(options: UploadOptions = {}) {
  const { onProgress, onPartComplete, onError, maxRetries = 3 } = options

  const isUploading = ref(false)
  const uploadProgress = ref<UploadProgress>({
    totalParts: 0,
    uploadedParts: 0,
    currentPartProgress: 0,
    overallProgress: 0,
    bytesUploaded: 0,
    totalBytes: 0
  })
  const abortController = ref<AbortController | null>(null)

  function updateOverallProgress(currentPartProgress: number) {
    const completedProgress = uploadProgress.value.uploadedParts * 100
    const total = (completedProgress + currentPartProgress) / uploadProgress.value.totalParts
    uploadProgress.value.overallProgress = Math.round(total)
  }

  function uploadPartToS3(url: string, body: Blob, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const partProgress = (event.loaded / event.total) * 100
          uploadProgress.value.currentPartProgress = partProgress
          updateOverallProgress(partProgress)
          onProgress?.(uploadProgress.value)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag")
          if (!etag) {
            reject(new Error("S3 response missing ETag header"))
            return
          }
          resolve(etag)
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"))
      })

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"))
      })

      signal.addEventListener("abort", () => {
        xhr.abort()
      })

      xhr.open("PUT", url)
      xhr.send(body)
    })
  }

  async function uploadFile(file: File): Promise<CompleteUploadResponse> {
    isUploading.value = true
    abortController.value = new AbortController()

    uploadProgress.value = {
      totalParts: 0,
      uploadedParts: 0,
      currentPartProgress: 0,
      overallProgress: 0,
      bytesUploaded: 0,
      totalBytes: file.size
    }

    try {
      // Step 1: Request presigned URLs from the server
      const { key, uploadId, partSize, totalParts, urls } = await $fetch<CreateUploadResponse>(
        "/api/assets/upload/create",
        {
          method: "POST",
          body: {
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || "application/octet-stream"
          }
        }
      )

      uploadProgress.value.totalParts = totalParts
      onProgress?.(uploadProgress.value)

      // Step 2: Upload each part directly to S3 via presigned URLs
      const completedParts: { partNumber: number; etag: string }[] = []

      for (const { partNumber, url } of urls) {
        const start = (partNumber - 1) * partSize
        const end = Math.min(start + partSize, file.size)
        const blob = file.slice(start, end)

        let etag: string | null = null
        let attempts = 0

        while (!etag && attempts <= maxRetries) {
          try {
            etag = await uploadPartToS3(url, blob, abortController.value.signal)
          } catch (error) {
            attempts++

            if (error instanceof Error && error.message === "Upload aborted") {
              throw error
            }

            if (attempts > maxRetries) {
              throw new Error(`Failed to upload part ${partNumber} after ${maxRetries} retries`)
            }

            // Exponential backoff before retry
            await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000))
          }
        }

        completedParts.push({ partNumber, etag: etag! })
        uploadProgress.value.uploadedParts++
        uploadProgress.value.bytesUploaded += end - start
        uploadProgress.value.currentPartProgress = 0
        updateOverallProgress(0)
        onProgress?.(uploadProgress.value)
        onPartComplete?.(partNumber)
      }

      // Step 3: Tell the server to finalize the multipart upload
      const result = await $fetch<CompleteUploadResponse>("/api/assets/upload/complete", {
        method: "POST",
        body: {
          key,
          uploadId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          parts: completedParts
        }
      })

      uploadProgress.value.overallProgress = 100
      onProgress?.(uploadProgress.value)

      isUploading.value = false
      return result
    } catch (error) {
      isUploading.value = false
      const err = error instanceof Error ? error : new Error("Upload failed")
      onError?.(err)
      throw err
    }
  }

  function cancelUpload() {
    abortController.value?.abort()
    isUploading.value = false
    uploadProgress.value = {
      totalParts: 0,
      uploadedParts: 0,
      currentPartProgress: 0,
      overallProgress: 0,
      bytesUploaded: 0,
      totalBytes: 0
    }
  }

  return {
    uploadFile,
    cancelUpload,
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value)
  }
}

// Backwards-compatible alias
export const useChunkedUpload = useUpload
export type ChunkUploadProgress = UploadProgress
export type ChunkedUploadOptions = UploadOptions
