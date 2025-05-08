<script setup lang="ts">
import { ref, computed } from "vue"
import { useFileDialog, useDropZone } from "@vueuse/core"
import { UploadCloudIcon, LoaderCircleIcon, ReplaceIcon, Trash2Icon } from "lucide-vue-next"
import type { AssetConfig, AssetType } from "~/types"

type AssetObject = { id: string; src: string; alt: string }

type Props = {
  value: AssetObject | null | undefined
  config: AssetConfig
  borderless?: boolean
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: AssetObject | null): void
}>()

const isLoading = ref(false)
const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const assetTypeToMimeMap: { [key: string]: string[] } = {
  image: ["image/*"],
  video: ["video/*"],
  audio: ["audio/*"],
  pdf: ["application/pdf"],
  other: []
}

const acceptedFileTypes = computed(() => {
  if (!props.config?.assetTypes || props.config.assetTypes.length === 0) {
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
  if (selectedFiles[0]) await uploadFile(selectedFiles[0])
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

function onDrop(files: File[] | null) {
  isDragging.value = false
  if (!files || files.length === 0 || !files[0]) return
  const file = files[0]
  if (!isValidFileType(file)) {
    toast.error({
      description: `File type not allowed.`,
      duration: 3000
    })
    return
  }
  uploadFile(file)
}

useDropZone(dropZoneRef, {
  onDrop,
  onLeave: () => {
    isDragging.value = false
  },
  onEnter: () => {
    isDragging.value = true
  }
})

async function uploadFile(file: File) {
  isLoading.value = true
  try {
    const formData = new FormData()
    formData.append("file", file)
    const fileIdOrUrl = await $fetch<string>("/api/assets", {
      method: "POST",
      body: formData
    })
    emit("update:value", { id: fileIdOrUrl, src: fileIdOrUrl, alt: "" })
  } catch (error) {
    console.error("Upload failed:", error)
    toast.error({
      description: "Upload failed",
      duration: 3000
    })
    emit("update:value", null)
  } finally {
    isLoading.value = false
  }
}

function clearAsset() {
  emit("update:value", null)
}

function changeAsset() {
  openFileDialog()
}
</script>

<template>
  <div class="relative h-30">
    <div
      v-if="props.value?.src"
      ref="dropZoneRef"
      class="relative flex h-full space-y-2"
    >
      <div
        class="group border-neutral relative h-full w-full overflow-hidden rounded-xl"
        :class="[borderless ? '' : 'border']"
      >
        <img
          :src="props.value.src"
          :alt="props.value.alt || 'Selected Asset'"
          class="block h-full w-full object-contain"
        />

        <div
          v-if="isLoading"
          class="bg-neutral/50 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
        >
          <LoaderCircleIcon class="text-neutral-subtle size-5 animate-spin" />
          <span class="text-copy ml-2">Uploading...</span>
        </div>

        <div
          v-else-if="isDragging"
          class="bg-neutral/80 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl"
        >
          <div class="text-center">
            <UploadCloudIcon class="text-neutral-subtle mx-auto mb-2 size-5" />
            <p class="text-copy-sm">Drop to replace</p>
          </div>
        </div>
      </div>
      <div
        class="absolute top-0 right-0 flex gap-1 p-2"
        :class="borderless ? '' : 'p-2'"
      >
        <DButton
          variant="secondary"
          size="sm"
          @click="changeAsset"
          :icon-left="ReplaceIcon"
        >
          Replace
        </DButton>
        <DButton
          variant="secondary"
          size="sm"
          @click="clearAsset"
          :icon-left="Trash2Icon"
        />
      </div>
    </div>

    <button
      v-else
      ref="dropZoneRef"
      class="border-neutral relative flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl border p-6 text-center transition-colors"
      :class="[
        isDragging ? 'bg-neutral-subtle' : 'border-neutral-soft bg-neutral-bg',
        isLoading ? 'cursor-wait opacity-75' : ''
      ]"
      tabindex="0"
      @click="!isLoading && openFileDialog()"
    >
      <div
        v-if="isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-md"
      >
        <LoaderCircleIcon class="text-neutral-subtle size-5 animate-spin" />
        <span class="text-copy ml-2">Uploading...</span>
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
</template>
