<script setup lang="ts">
import { ref } from "vue"
import { useFileDialog, useDropZone } from "@vueuse/core"
import { UploadCloudIcon, LoaderCircleIcon, ReplaceIcon, Trash2Icon } from "lucide-vue-next"

type Props = {
  value: string | null | undefined
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: string | null): void
}>()

const isLoading = ref(false)
const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const { open: openFileDialog, onChange: onFileDialogChange } = useFileDialog({
  accept: "image/*",
  multiple: false
})

onFileDialogChange(async (selectedFiles) => {
  if (!selectedFiles || selectedFiles.length === 0) return
  await uploadFile(selectedFiles[0])
})

function onDrop(files: File[] | null) {
  isDragging.value = false // Ensure dragging state is reset
  if (!files || files.length === 0) return
  // Simple check if the dropped file is an image (client-side)
  const file = files[0]
  if (file.type.startsWith("image/")) {
    uploadFile(file)
  } else {
    console.warn("Dropped file is not an image:", file.type)
    // Optionally show a user-facing error message here
  }
}

// Simplified useDropZone configuration - removed dataTypes
useDropZone(dropZoneRef, {
  onDrop,
  onLeave: () => {
    isDragging.value = false
  },
  onEnter: () => {
    isDragging.value = true
  }
  // dataTypes: ['image/*'] // Temporarily removed for broader testing
})

async function uploadFile(file: File) {
  isLoading.value = true
  try {
    const formData = new FormData()
    formData.append("file", file)
    const fileId = await $fetch<string>("/api/assets", {
      method: "POST",
      body: formData
    })
    emit("update:value", fileId)
  } catch (error) {
    console.error("Upload failed:", error)
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
  <div class="relative h-40">
    <div
      v-if="props.value"
      class="relative flex h-full space-y-2"
    >
      <div class="group border-neutral relative h-full w-full overflow-hidden rounded-xl border">
        <img
          :src="props.value"
          alt="Selected Asset"
          class="block h-full w-full object-contain"
        />
      </div>
      <div class="absolute top-0 right-0 flex gap-1 p-2">
        <DButton
          variant="secondary"
          size="sm"
          @click="changeAsset"
          :icon-left="ReplaceIcon"
        />
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
        <LoaderCircleIcon class="text-neutral-subtle h-8 w-8 animate-spin" />
        <span class="text-copy ml-2">Uploading...</span>
      </div>

      <div
        v-if="!isLoading"
        class="text-neutral pointer-events-none flex flex-col items-center"
      >
        <UploadCloudIcon class="text-neutral-subtle mb-2 size-5" />
        <p class="text-copy-sm">
          <span v-if="isDragging">Drop file to upload</span>
          <span v-else>Drag & drop image here, or</span>
        </p>
        <DButton
          variant="secondary"
          size="sm"
          class="mt-2"
          tabindex="-1"
        >
          Select File
        </DButton>
      </div>
    </button>
  </div>
</template>
