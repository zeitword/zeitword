<script setup lang="ts">
import { ref, computed } from "vue"
import { useFileDialog, useDropZone } from "@vueuse/core"
import { UploadCloudIcon, LoaderCircleIcon } from "lucide-vue-next"
import type { AssetConfig, AssetType, AssetObject } from "~/types"
import { useChunkedUpload } from "~/composables/useChunkedUpload"

type Props = {
  value: AssetObject | null | undefined
  config?: AssetConfig
  borderless?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  config: undefined,
  borderless: false
})

const emit = defineEmits<{
  (e: "update:value", value: AssetObject | null): void
}>()

const isLoading = ref(false)
const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const uploadProgress = ref(0)

const assetTypeToMimeMap: { [key: string]: string[] } = {
  image: ["image/*"],
  video: ["video/*"],
  audio: ["audio/*"],
  pdf: ["application/pdf"],
  other: []
}

const allowedTypesString = computed(() => {
  if (!props.config || !props.config?.assetTypes || props.config.assetTypes.length === 0) {
    return "all files"
  }
  return props.config.assetTypes.map((type) => type.display.toLowerCase()).join(", ")
})

const acceptedFileTypes = computed(() => {
  if (!props.config || !props.config?.assetTypes || props.config.assetTypes.length === 0) {
    return ""
  }
  const mimeTypes: string[] = []
  props.config.assetTypes.forEach((type: AssetType) => {
    const mimeTypeArray = assetTypeToMimeMap[type.value]
    if (mimeTypeArray) {
      mimeTypes.push(...mimeTypeArray)
    }
  })
  return mimeTypes.join(",")
})

const { open: openFileDialog, onChange: onFileDialogChange } = useFileDialog({
  multiple: false,
  accept: acceptedFileTypes.value
})

onFileDialogChange(async (selectedFiles) => {
  if (!selectedFiles || selectedFiles.length === 0) return
  if (selectedFiles[0]) {
    if (!isValidFileType(selectedFiles[0])) {
      toast.error({
        description: `File type not allowed.`,
        duration: 3000
      })
      return
    }
    await uploadFile(selectedFiles[0])
  }
})

const { toast } = useToast()

function isValidFileType(file: File): boolean {
  if (!props.config?.assetTypes || props.config.assetTypes.length === 0) {
    return true
  }

  const allowedMimeTypes: string[] = []
  props.config.assetTypes.forEach((type: AssetType) => {
    const mimeTypeArray = assetTypeToMimeMap[type.value]
    if (mimeTypeArray) {
      allowedMimeTypes.push(...mimeTypeArray)
    }
  })

  return allowedMimeTypes.some((mimeType) => file.type.startsWith(mimeType.slice(0, -1)))
}

async function uploadFile(file: File) {
  isLoading.value = true
  uploadProgress.value = 0

  try {
    // Use chunked upload for all files
    const { uploadFile: chunkedUpload } = useChunkedUpload({
      chunkSize: 2.5 * 1024 * 1024, // 2.5MB chunks
      maxRetries: 3,
      onProgress: (progress) => {
        uploadProgress.value = progress.overallProgress
      },
      onError: (error) => {
        console.error("Upload error:", error)
      }
    })

    const asset = await chunkedUpload(file)
    emit("update:value", { id: asset.id, src: asset.src, alt: file.name, type: asset.type })
  } catch (error) {
    console.error(error)
    toast.error({
      description: "Upload failed",
      duration: 3000
    })
    emit("update:value", null)
  } finally {
    isLoading.value = false
    uploadProgress.value = 0
  }
}

function clearAsset() {
  emit("update:value", null)
}

function changeAsset() {
  openFileDialog()
}

async function replaceAsset(file: File) {
  emit("update:value", null)
  await uploadFile(file)
}

function handleUpdateAlt(newAlt: string) {
  const newValue = {
    ...props.value,
    alt: newAlt
  }
  if (!newValue) return

  emit("update:value", newValue)
}

useDropZone(dropZoneRef, {
  onDrop: (files) => {
    isDragging.value = false
    if (files && files[0]) {
      if (!isValidFileType(files[0])) {
        toast.error({
          description: `File type not allowed.`,
          duration: 3000
        })
        return
      }
      replaceAsset(files[0])
    }
  },
  onEnter: () => {
    isDragging.value = true
  },
  onLeave: () => {
    isDragging.value = false
  }
})
</script>

<template>
  <div class="border-neutral bg-neutral-subtle relative rounded-[10px] border p-0.5">
    <div class="border-neutral overflow-hidden rounded-lg border">
      <DAssetDisplay
        v-if="props.value?.src"
        :asset="props.value"
        :borderless="props.borderless"
        @clearAsset="clearAsset"
        @changeAsset="changeAsset"
        @updateAlt="(newAlt) => handleUpdateAlt(newAlt)"
        @assetDropped="
          (file) => {
            if (!isValidFileType(file)) {
              toast.error({
                description: `File type not allowed.`,
                duration: 3000
              })
              return
            }
            replaceAsset(file)
          }
        "
      />
      <button
        v-else
        ref="dropZoneRef"
        class="relative flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl p-6 text-center transition-colors"
        :class="[
          isDragging ? 'bg-neutral-subtle' : 'border-neutral-soft bg-neutral-bg',
          isLoading ? 'cursor-wait opacity-75' : ''
        ]"
        tabindex="0"
        @click="!isLoading && openFileDialog()"
      >
        <div
          v-if="isLoading"
          class="bg-neutral-bg/90 absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md"
        >
          <LoaderCircleIcon class="text-neutral-subtle size-5 animate-spin" />
          <span class="text-copy mt-2">
            Uploading{{ uploadProgress > 0 ? ` ${uploadProgress}%` : "..." }}
          </span>
          <div
            v-if="uploadProgress > 0"
            class="bg-neutral-weak mt-2 h-1 w-32 overflow-hidden rounded-full"
          >
            <div
              class="bg-neutral-inverse h-full transition-all duration-300"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
        </div>

        <div
          v-if="!isLoading"
          class="text-neutral pointer-events-none flex flex-col items-center"
        >
          <UploadCloudIcon class="text-neutral-subtle mb-2 size-5" />
          <p class="text-copy-sm text-neutral-subtle">
            <span v-if="isDragging">Drop file to upload</span>
            <span v-else>Drag & drop file here, or</span>
          </p>
          <p class="text-copy-sm text-neutral-subtle">({{ allowedTypesString }})</p>
          <DButton
            variant="secondary"
            size="sm"
            class="mt-2"
            tabindex="-1"
          >
            Select file
          </DButton>
        </div>
      </button>
    </div>
  </div>
</template>
