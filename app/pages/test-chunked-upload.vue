<template>
  <d-page>
    <d-page-header>
      <d-page-title>Chunked Upload Test</d-page-title>
    </d-page-header>

    <d-page-content>
      <div class="mx-auto max-w-2xl space-y-8">
        <div class="rounded-lg bg-white p-6 shadow">
          <h2 class="mb-4 text-lg font-semibold">Upload Large Files</h2>
          <p class="mb-6 text-sm text-neutral-600">
            This uploader splits files into 2.5MB chunks for reliable uploads of large files. The
            chunks are merged server-side with memory-efficient processing.
          </p>

          <d-asset-chunked-upload
            accept="image/*,video/*,application/pdf"
            :max-size="10 * 1024 * 1024 * 1024"
            @upload-complete="handleUploadComplete"
            @upload-error="handleUploadError"
          />
        </div>

        <!-- Uploaded Assets List -->
        <div
          v-if="uploadedAssets.length > 0"
          class="rounded-lg bg-white p-6 shadow"
        >
          <h3 class="mb-4 text-lg font-semibold">Uploaded Assets</h3>
          <div class="space-y-3">
            <div
              v-for="asset in uploadedAssets"
              :key="asset.id"
              class="flex items-center justify-between rounded-md bg-neutral-50 p-3"
            >
              <div class="flex items-center gap-3">
                <Icon
                  :name="getIconForType(asset.type)"
                  class="h-8 w-8 text-neutral-600"
                />
                <div>
                  <p class="text-sm font-medium">{{ asset.fileName }}</p>
                  <p class="text-xs text-neutral-500">{{ asset.type }} • {{ asset.id }}</p>
                </div>
              </div>
              <a
                :href="asset.src"
                target="_blank"
                class="text-sm text-blue-600 hover:text-blue-700"
              >
                View
              </a>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="rounded-lg bg-blue-50 p-6">
          <h3 class="mb-2 text-sm font-semibold text-blue-900">How it works:</h3>
          <ol class="list-inside list-decimal space-y-1 text-sm text-blue-800">
            <li>Select a file (up to 10GB)</li>
            <li>File is split into 2.5MB chunks client-side</li>
            <li>Each chunk is uploaded individually with retry logic</li>
            <li>Server merges chunks in pairs to create 5MB intermediate chunks</li>
            <li>Final file is assembled using S3 multipart upload</li>
            <li>All temporary chunks are cleaned up automatically</li>
          </ol>
        </div>
      </div>
    </d-page-content>
  </d-page>
</template>

<script setup lang="ts">
import { ref } from "vue"

interface UploadedAsset {
  id: string
  src: string
  type: string
  fileName: string
}

const uploadedAssets = ref<UploadedAsset[]>([])

function handleUploadComplete(asset: UploadedAsset) {
  uploadedAssets.value.unshift(asset)
}

function handleUploadError(error: Error) {
  console.error("Upload error:", error)
}

function getIconForType(type: string): string {
  switch (type) {
    case "image":
      return "heroicons:photo"
    case "video":
      return "heroicons:video-camera"
    case "audio":
      return "heroicons:musical-note"
    case "pdf":
      return "heroicons:document-text"
    default:
      return "heroicons:document"
  }
}
</script>
