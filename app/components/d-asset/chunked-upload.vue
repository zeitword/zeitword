<template>
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="handleFileSelect"
        :accept="accept"
      />
      <d-button
        @click="selectFile"
        :disabled="isUploading"
        variant="secondary"
      >
        <Icon
          name="heroicons:arrow-up-tray"
          class="mr-2 h-4 w-4"
        />
        {{ isUploading ? "Uploading..." : "Select File" }}
      </d-button>

      <d-button
        v-if="isUploading"
        @click="cancelUpload"
        variant="danger"
        size="sm"
      >
        Cancel
      </d-button>
    </div>

    <!-- Upload Progress -->
    <div
      v-if="isUploading || uploadProgress.overallProgress > 0"
      class="space-y-2"
    >
      <div class="flex justify-between text-sm text-neutral-600">
        <span>
          Uploading chunk {{ uploadProgress.uploadedChunks + 1 }} of
          {{ uploadProgress.totalChunks }}
        </span>
        <span>{{ uploadProgress.overallProgress }}%</span>
      </div>

      <div class="h-2 w-full rounded-full bg-neutral-200">
        <div
          class="h-2 rounded-full bg-blue-600 transition-all duration-300"
          :style="{ width: `${uploadProgress.overallProgress}%` }"
        />
      </div>

      <div class="text-xs text-neutral-500">
        {{ formatBytes(uploadProgress.bytesUploaded) }} /
        {{ formatBytes(uploadProgress.totalBytes) }}
      </div>
    </div>

    <!-- Error Display -->
    <div
      v-if="error"
      class="bg-danger-50 border-danger-200 rounded-md border p-3"
    >
      <p class="text-danger-700 text-sm">{{ error }}</p>
    </div>

    <!-- Success Message -->
    <div
      v-if="uploadedAsset && !isUploading"
      class="bg-success-50 border-success-200 rounded-md border p-3"
    >
      <p class="text-success-700 text-sm">File uploaded successfully!</p>
      <p class="text-success-600 mt-1 text-xs">ID: {{ uploadedAsset.id }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { useChunkedUpload } from "~~/app/composables/useChunkedUpload"
import { useToast } from "~~/app/composables/useToast"

interface Props {
  accept?: string
  maxSize?: number // in bytes
  onUploadComplete?: (asset: { id: string; src: string; type: string; fileName: string }) => void
}

const props = withDefaults(defineProps<Props>(), {
  accept: "*/*",
  maxSize: 5 * 1024 * 1024 * 1024 // 5GB default
})

const emit = defineEmits<{
  "upload-complete": [asset: { id: string; src: string; type: string; fileName: string }]
  "upload-error": [error: Error]
}>()

const fileInput = ref<HTMLInputElement>()
const error = ref<string>("")
const uploadedAsset = ref<{ id: string; src: string; type: string; fileName: string } | null>(null)
const { showToast } = useToast()

const { uploadFile, cancelUpload, isUploading, uploadProgress } = useChunkedUpload({
  chunkSize: 2.5 * 1024 * 1024, // 2.5MB chunks
  maxRetries: 3,
  onProgress: (progress) => {
    // Progress is automatically tracked by the composable
  },
  onChunkComplete: (chunkIndex) => {
    console.log(`Chunk ${chunkIndex + 1} uploaded successfully`)
  },
  onError: (err) => {
    error.value = err.message
    emit("upload-error", err)
    showToast({
      title: "Upload Failed",
      description: err.message,
      variant: "danger"
    })
  }
})

function selectFile() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Reset state
  error.value = ""
  uploadedAsset.value = null

  // Validate file size
  if (file.size > props.maxSize) {
    error.value = `File size exceeds maximum allowed size of ${formatBytes(props.maxSize)}`
    return
  }

  try {
    const asset = await uploadFile(file)
    uploadedAsset.value = asset

    // Emit events
    emit("upload-complete", asset)
    props.onUploadComplete?.(asset)

    showToast({
      title: "Upload Complete",
      description: `${file.name} uploaded successfully`,
      variant: "success"
    })

    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = ""
    }
  } catch (err) {
    // Error is already handled by the onError callback
    console.error("Upload failed:", err)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
</script>
