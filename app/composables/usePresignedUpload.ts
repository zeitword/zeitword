import { ref, computed } from "vue"

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface PresignedUploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onError?: (error: Error) => void
}

interface PresignedUrlResponse {
  uploadUrl: string
  assetId: string
  assetUrl: string
  assetType: string
}

export function usePresignedUpload(options: PresignedUploadOptions = {}) {
  const { onProgress, onError } = options

  const isUploading = ref(false)
  const uploadProgress = ref<UploadProgress>({ loaded: 0, total: 0, percentage: 0 })

  async function uploadFile(file: File) {
    isUploading.value = true
    uploadProgress.value = { loaded: 0, total: file.size, percentage: 0 }

    try {
      // Step 1: Get pre-signed URL from server
      const response = await $fetch<PresignedUrlResponse>(
        "/api/assets/presigned-url",
        {
          method: "POST",
          body: {
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size
          }
        }
      )

      // Step 2: Upload directly to S3 using pre-signed URL
      // Note: We use XMLHttpRequest for progress tracking since fetch doesn't support upload progress
      // For a more modern approach without progress, we could use:
      // const uploadResponse = await fetch(response.uploadUrl, {
      //   method: "PUT",
      //   body: file,
      //   headers: {
      //     "Content-Type": file.type || "application/octet-stream"
      //   }
      // })
      
      // Using XMLHttpRequest for progress tracking
      const uploadResponse = await uploadWithProgress(
        response.uploadUrl,
        file,
        (progress) => {
          uploadProgress.value = progress
          onProgress?.(progress)
        }
      )

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`)
      }

      isUploading.value = false

      return {
        id: response.assetId,
        src: response.assetUrl,
        type: response.assetType,
        fileName: file.name
      }
    } catch (error) {
      isUploading.value = false

      const err = error instanceof Error ? error : new Error("Upload failed")
      onError?.(err)
      throw err
    }
  }

  return {
    uploadFile,
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value)
  }
}

// Helper function to upload with progress tracking
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100)
        })
      }
    })

    xhr.addEventListener("load", () => {
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status })
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"))
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"))
    })

    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.send(file)
  })
}
