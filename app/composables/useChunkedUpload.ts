import { ref, computed } from "vue"
// @ts-ignore
import { uuidv7 } from "uuidv7"

export interface ChunkUploadProgress {
  totalChunks: number
  uploadedChunks: number
  currentChunkProgress: number
  overallProgress: number
  bytesUploaded: number
  totalBytes: number
}

export interface ChunkedUploadOptions {
  chunkSize?: number // Default 2.5MB
  onProgress?: (progress: ChunkUploadProgress) => void
  onChunkComplete?: (chunkIndex: number) => void
  onError?: (error: Error) => void
  maxRetries?: number
}

interface ChunkInfo {
  index: number
  start: number
  end: number
  size: number
  chunkId: string
  retries: number
}

interface ChunkUploadResponse {
  chunkId: string
  index: number
  size: number
}

interface CompleteUploadResponse {
  id: string
  src: string
  type: string
  fileName: string
}

export function useChunkedUpload(options: ChunkedUploadOptions = {}) {
  const {
    chunkSize = 2.5 * 1024 * 1024, // 2.5MB default
    onProgress,
    onChunkComplete,
    onError,
    maxRetries = 3
  } = options

  const isUploading = ref(false)
  const uploadProgress = ref<ChunkUploadProgress>({
    totalChunks: 0,
    uploadedChunks: 0,
    currentChunkProgress: 0,
    overallProgress: 0,
    bytesUploaded: 0,
    totalBytes: 0
  })
  const uploadId = ref<string>("")
  const abortController = ref<AbortController | null>(null)

  function createChunks(file: File): ChunkInfo[] {
    const chunks: ChunkInfo[] = []
    const totalChunks = Math.ceil(file.size / chunkSize)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        chunkId: uuidv7(),
        retries: 0
      })
    }

    return chunks
  }

  async function uploadChunk(
    file: File,
    chunk: ChunkInfo,
    uploadId: string
  ): Promise<ChunkUploadResponse> {
    const chunkBlob = file.slice(chunk.start, chunk.end)
    const formData = new FormData()
    formData.append("chunk", chunkBlob)
    formData.append("chunkId", chunk.chunkId)
    formData.append("chunkIndex", chunk.index.toString())
    formData.append("uploadId", uploadId)
    formData.append("totalChunks", uploadProgress.value.totalChunks.toString())
    formData.append("fileName", file.name)
    formData.append("fileSize", file.size.toString())
    formData.append("contentType", file.type || "application/octet-stream")

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const chunkProgress = (event.loaded / event.total) * 100
          uploadProgress.value.currentChunkProgress = chunkProgress
          updateOverallProgress(chunk.index, chunkProgress)
          onProgress?.(uploadProgress.value)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText) as ChunkUploadResponse
            resolve(response)
          } catch (error) {
            reject(new Error("Invalid response format"))
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during chunk upload"))
      })

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"))
      })

      if (abortController.value?.signal) {
        abortController.value.signal.addEventListener("abort", () => {
          xhr.abort()
        })
      }

      xhr.open("POST", "/api/assets/chunk")
      xhr.send(formData)
    })
  }

  function updateOverallProgress(_currentChunkIndex: number, chunkProgress: number) {
    const completedChunksProgress = uploadProgress.value.uploadedChunks * 100
    const currentProgress = chunkProgress
    const totalProgress =
      (completedChunksProgress + currentProgress) / uploadProgress.value.totalChunks
    uploadProgress.value.overallProgress = Math.round(totalProgress)
  }

  async function uploadFileInChunks(file: File) {
    isUploading.value = true
    uploadId.value = uuidv7()
    abortController.value = new AbortController()

    const chunks = createChunks(file)
    uploadProgress.value = {
      totalChunks: chunks.length,
      uploadedChunks: 0,
      currentChunkProgress: 0,
      overallProgress: 0,
      bytesUploaded: 0,
      totalBytes: file.size
    }

    try {
      // Upload chunks sequentially with retry logic
      for (const chunk of chunks) {
        let uploaded = false
        let lastError: Error | null = null

        while (!uploaded && chunk.retries <= maxRetries) {
          try {
            await uploadChunk(file, chunk, uploadId.value)
            uploaded = true
            uploadProgress.value.uploadedChunks++
            uploadProgress.value.bytesUploaded += chunk.size
            onChunkComplete?.(chunk.index)
          } catch (error) {
            chunk.retries++
            lastError = error instanceof Error ? error : new Error("Upload failed")

            if (chunk.retries > maxRetries) {
              throw new Error(
                `Failed to upload chunk ${chunk.index} after ${maxRetries} retries: ${lastError.message}`
              )
            }

            // Wait before retrying (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, chunk.retries) * 1000))
          }
        }
      }

      // Complete the upload
      const completeResponse = await $fetch<CompleteUploadResponse>("/api/assets/chunk/complete", {
        method: "POST",
        body: {
          uploadId: uploadId.value,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream",
          totalChunks: chunks.length,
          chunkIds: chunks.map((c) => c.chunkId)
        }
      })

      isUploading.value = false
      return completeResponse
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
      totalChunks: 0,
      uploadedChunks: 0,
      currentChunkProgress: 0,
      overallProgress: 0,
      bytesUploaded: 0,
      totalBytes: 0
    }
  }

  return {
    uploadFile: uploadFileInChunks,
    cancelUpload,
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value),
    uploadId: computed(() => uploadId.value)
  }
}
