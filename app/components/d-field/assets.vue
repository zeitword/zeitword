<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue"
import { GripVertical, UploadCloudIcon, LoaderCircleIcon } from "lucide-vue-next"
import type { DField } from "~/types/models"
import { LexoRank } from "lexorank"
import Sortable from "sortablejs"
import { uuidv7 } from "uuidv7"
import { useFileDialog, useDropZone } from "@vueuse/core"
import { useAssetValidation } from "~/composables/useAssetValidation"
import type { AssetConfig } from "~/types"
import { useChunkedUpload } from "~/composables/useChunkedUpload"

const { toast } = useToast()

type AssetObject = {
  id: string
  src: string
  alt: string
  order: string
  type: string
}

type Props = {
  field: DField
  path?: string[]
  value: AssetObject[] | null | undefined
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: AssetObject[] | null): void
}>()

const addDropZoneRef = ref<HTMLElement | null>(null)
const isAddingDragging = ref(false)
const isUploading = ref(false)
const assetsContainer = ref<HTMLElement | null>(null)
const uploadProgress = ref<Record<string, number>>({})
// Use chunked upload for larger files
const CHUNK_UPLOAD_THRESHOLD = 4 * 1024 * 1024 // 4MB

const sortedAssets = ref<AssetObject[]>([])
const sortableInstance = ref<Sortable | null>(null)
const isMounted = ref(false)

const isMaxReached = computed(() => {
  if (!props.field.maxValue) return false
  return sortedAssets.value.length >= props.field.maxValue
})

const assetConfig = props.field.config as AssetConfig
let assetTypes = undefined

if (assetConfig && assetConfig.assetTypes) {
  assetTypes = assetConfig.assetTypes
}

const { allowedTypesString, isValidFileType } = useAssetValidation(assetTypes)

const { open: openFileDialog, onChange: onFileDialogChange } = useFileDialog({
  accept: "image/*",
  multiple: true
})

onFileDialogChange(async (selectedFiles) => {
  if (!selectedFiles || selectedFiles.length === 0) return
  await handleFileUploads(Array.from(selectedFiles))
})

async function handleFileUploads(files: File[]) {
  if (isUploading.value || isMaxReached.value) return

  const availableSlots = props.field.maxValue
    ? props.field.maxValue - sortedAssets.value.length
    : files.length
  if (availableSlots <= 0 && props.field.maxValue) {
    console.warn("Cannot add more assets, limit reached.")
    return
  }

  const filesToUpload = files.slice(0, availableSlots)

  isUploading.value = true

  let lastRank =
    sortedAssets.value.length > 0
      ? LexoRank.parse(sortedAssets.value[sortedAssets.value.length - 1].order)
      : LexoRank.middle()

  const validatedFiles = filesToUpload.filter((file) => {
    if (isValidFileType(file)) {
      return file
    } else {
      console.log(file)
      toast.error({
        description: `${file.name} is not the correct file type`
      })
    }
  })

  const uploadPromises = validatedFiles.map(async (file) => {
    const fileId = uuidv7() // Generate unique ID for progress tracking
    try {
      let asset: { id: string; src: string; type: string; fileName: string }

      // Use chunked upload for files larger than 4MB
      if (file.size > CHUNK_UPLOAD_THRESHOLD) {
        uploadProgress.value[fileId] = 0

        const { uploadFile: chunkedUpload } = useChunkedUpload({
          onProgress: (progress) => {
            uploadProgress.value[fileId] = progress.percentage
          },
          onError: (error) => {
            console.error("Chunked upload error for file:", file.name, error)
            delete uploadProgress.value[fileId]
          }
        })

        asset = await chunkedUpload(file)
        delete uploadProgress.value[fileId]
      } else {
        // Use regular upload for smaller files
        const formData = new FormData()
        formData.append("file", file)
        asset = await $fetch<{ id: string; src: string; type: string; fileName: string }>(
          "/api/assets",
          {
            method: "POST",
            body: formData
          }
        )
      }

      return { ...asset, fileName: file.name }
    } catch (error) {
      console.error("Upload failed for file:", file.name, error)
      toast.error({
        description: `Failed to upload ${file.name}`
      })
      return null
    }
  })

  const results = await Promise.all(uploadPromises)
  const newAssetObjects: AssetObject[] = []

  results.forEach((asset) => {
    if (asset) {
      const newRank = lastRank.genNext()
      newAssetObjects.push({
        id: uuidv7(),
        src: asset.src,
        alt: asset.fileName,
        order: newRank.toString(),
        type: asset.type
      })
      lastRank = newRank
    }
  })

  isUploading.value = false

  if (newAssetObjects.length > 0) {
    const updatedValue = [...sortedAssets.value, ...newAssetObjects]
    // Ensure sorting after adding, though LexoRank should maintain order
    updatedValue.sort((a, b) => a.order.localeCompare(b.order))
    emit("update:value", updatedValue)
  }
}

// Handles updates from individual DAsset components (replace/clear)
function handleAssetUpdate(
  listItemId: string,
  newAssetValue: AssetObject | null // Changed type here
) {
  const currentAssets = [...sortedAssets.value]
  const index = currentAssets.findIndex((asset) => asset.id === listItemId)

  if (index === -1) {
    console.error("Asset list item not found for update:", listItemId)
    return
  }

  if (newAssetValue === null) {
    currentAssets.splice(index, 1)
  } else {
    currentAssets[index] = newAssetValue
  }

  emit("update:value", currentAssets.length > 0 ? currentAssets : null) // Emit null if list becomes empty
}

function handleClearAsset(assetId: string) {
  const currentAssets = [...sortedAssets.value]
  const index = currentAssets.findIndex((asset) => asset.id === assetId)

  if (index === -1) {
    console.error("Asset list item not found for delete:", assetId)
    return
  }

  currentAssets.splice(index, 1)
  emit("update:value", currentAssets.length > 0 ? currentAssets : null)
}

function handleChangeAsset(asset: AssetObject) {
  openFileDialog()
}

function recalculateAssetOrders(assets: AssetObject[]): AssetObject[] {
  console.warn("Recalculating all asset orders due to collision or request.")
  let currentRank = LexoRank.middle()
  const reorderedAssets = assets.map((asset) => {
    const newOrder = currentRank.toString()
    currentRank = currentRank.genNext()
    return { ...asset, order: newOrder }
  })
  return reorderedAssets
}

async function initSortable() {
  if (!assetsContainer.value || !isMounted.value) return
  await nextTick()

  if (sortableInstance.value) sortableInstance.value.destroy()

  sortableInstance.value = new Sortable(assetsContainer.value, {
    handle: ".drag-handle",
    animation: 200,
    dataIdAttr: "data-asset-id", // Use the unique 'id' field
    onUpdate: (evt: Sortable.SortableEvent) => {
      if (evt.oldIndex === undefined || evt.newIndex === undefined) return

      const movedItemId = evt.item.getAttribute("data-asset-id")
      if (!movedItemId) {
        console.error("Could not find data-asset-id on moved item")
        return
      }

      let currentAssets = [...sortedAssets.value] // Work with a mutable copy

      // Find and physically move the item in the array based on SortableJS event indices
      const movedItemIndex = currentAssets.findIndex((a) => a.id === movedItemId)
      if (movedItemIndex === -1) {
        console.error("Moved item object not found in state:", movedItemId)
        return
      }
      // Use evt.oldIndex and evt.newIndex which reflect the DOM order *before* this callback
      const [movedAsset] = currentAssets.splice(evt.oldIndex, 1)
      currentAssets.splice(evt.newIndex, 0, movedAsset)

      // --- Calculate new LexoRank ---
      let newRank: LexoRank
      const newIndex = evt.newIndex // The index where the item *is now* in the array

      if (newIndex === 0) {
        // Moved to the beginning
        newRank =
          currentAssets.length > 1
            ? LexoRank.parse(currentAssets[1].order).genPrev() // Get rank before the new second item
            : LexoRank.middle() // Only item
      } else if (newIndex === currentAssets.length - 1) {
        // Moved to the end
        newRank = LexoRank.parse(currentAssets[newIndex - 1].order).genNext() // Get rank after the new second-to-last item
      } else {
        // Moved somewhere in the middle
        const prevRank = LexoRank.parse(currentAssets[newIndex - 1].order)
        const nextRank = LexoRank.parse(currentAssets[newIndex + 1].order)

        // Check for rank collision potential
        if (
          prevRank.equals(nextRank) ||
          prevRank.between(nextRank).equals(prevRank) ||
          prevRank.between(nextRank).equals(nextRank)
        ) {
          console.warn("Potential LexoRank collision detected during reorder, recalculating all.")
          currentAssets = recalculateAssetOrders(currentAssets) // Recalculate orders for the whole list
          emit("update:value", currentAssets)
          return // Stop further processing for this move
        }
        newRank = prevRank.between(nextRank) // Calculate intermediate rank
      }

      // --- Update the moved asset's order and emit ---
      // Find the moved asset again in the *potentially reordered* array
      const finalMovedAssetIndex = currentAssets.findIndex((a) => a.id === movedItemId)
      if (finalMovedAssetIndex !== -1) {
        currentAssets[finalMovedAssetIndex] = {
          ...currentAssets[finalMovedAssetIndex],
          order: newRank.toString() // Apply the newly calculated rank
        }
        emit("update:value", currentAssets)
      } else {
        // This should ideally not happen if array manipulation is correct
        console.error(
          "Moved asset disappeared during rank calculation? Emitting recalculated list."
        )
        emit("update:value", recalculateAssetOrders(currentAssets)) // Fallback to recalculate all
      }
    }
  })
}

// Watch the incoming value prop and initialize/update the sortable list
watch(
  [() => props.value, () => isMounted.value],
  async ([newValue, mounted]) => {
    if (mounted) {
      // Ensure we have a valid array, default to empty array if not
      const valueArray = Array.isArray(newValue) ? [...newValue] : []
      // Sort based on the 'order' field before assigning to reactive ref
      valueArray.sort((a, b) => (a.order || "").localeCompare(b.order || ""))
      sortedAssets.value = valueArray

      // Re-initialize SortableJS after the DOM updates
      await nextTick()
      initSortable()
    }
  },
  { deep: true, immediate: true } // Immediate run + deep watch for changes within objects
)

onMounted(() => {
  isMounted.value = true
  // Initial sortable init is handled by the watcher's immediate run if value is present
})

onBeforeUnmount(() => {
  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }
})

useDropZone(addDropZoneRef, {
  onDrop: (files) => {
    isAddingDragging.value = false
    if (!files || files.length === 0) return

    if (files.length > 0) {
      handleFileUploads(files)
    } else {
      console.warn("No image files dropped.")
    }
  },
  onLeave: () => {
    isAddingDragging.value = false
  },
  onEnter: () => {
    isAddingDragging.value = true
  }
})

function handleUpdateAlt(assetId: string, newAlt: string) {
  const currentAssets = [...sortedAssets.value]
  const index = currentAssets.findIndex((asset) => asset.id === assetId)

  if (index === -1) {
    console.error("Asset list item not found for update:", assetId)
    return
  }

  currentAssets[index] = {
    ...currentAssets[index],
    alt: newAlt
  }

  emit("update:value", currentAssets.length > 0 ? currentAssets : null)
}
</script>

<template>
  <div
    class="bg-neutral border-neutral assets-container overflow-hidden rounded-[10px] border p-0.5"
  >
    <div
      ref="assetsContainer"
      class="border-neutral flex flex-col overflow-hidden rounded-lg border"
      v-if="sortedAssets.length > 0"
    >
      <div
        v-for="asset in sortedAssets"
        :key="asset.id"
        :data-asset-id="asset.id"
        class="group bg-neutral border-neutral bg-neutral-bg relative flex items-center gap-1 border-b last:border-none"
      >
        <div class="flex-grow">
          <DAssetDisplay
            :asset="asset"
            @clearAsset="handleClearAsset(asset.id)"
            @changeAsset="handleChangeAsset(asset)"
            @updateAlt="(newAlt) => handleUpdateAlt(asset.id, newAlt)"
            :allowedTypesString="allowedTypesString"
            borderless
          >
            <template #controls>
              <DButton
                class="drag-handle cursor-grab opacity-50 transition-all group-hover:opacity-100"
                no-cursor
                :icon-left="GripVertical"
                size="sm"
                variant="transparent"
                aria-label="Drag to reorder asset"
              />
            </template>
          </DAssetDisplay>
        </div>
      </div>
    </div>

    <div class="p-1">
      <button
        ref="addDropZoneRef"
        class="border-neutral-subtle relative flex h-30 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-1 border-dashed p-4 text-center transition-colors"
        :class="[
          isAddingDragging
            ? 'border-neutral bg-neutral-subtle'
            : 'hover:border-neutral hover:bg-neutral-soft',
          isUploading ? 'cursor-wait opacity-75' : '',
          isMaxReached ? 'hidden' : '' // Hide add button if max is reached
        ]"
        :disabled="isUploading || isMaxReached"
        @click="!isUploading && !isMaxReached && openFileDialog()"
        aria-label="Add new assets"
      >
        <div
          v-if="isUploading"
          class="bg-neutral-bg/90 absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md"
        >
          <LoaderCircleIcon class="text-neutral-subtle mb-2 h-6 w-6 animate-spin" />
          <span class="text-copy-sm text-neutral">
            Uploading{{
              Object.keys(uploadProgress).length > 0
                ? ` (${Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Object.keys(uploadProgress).length)}%)`
                : "..."
            }}
          </span>
          <div
            v-if="Object.keys(uploadProgress).length > 0"
            class="bg-neutral-weak mt-2 h-1 w-32 overflow-hidden rounded-full"
          >
            <div
              class="bg-neutral-inverse h-full transition-all duration-300"
              :style="{
                width: `${Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Object.keys(uploadProgress).length)}%`
              }"
            />
          </div>
        </div>

        <div
          v-if="!isUploading"
          class="text-neutral pointer-events-none flex flex-col items-center"
        >
          <UploadCloudIcon class="text-neutral-subtle mb-2 size-5" />
          <p class="text-copy-sm">
            <span v-if="isAddingDragging">Drop files(s) to upload</span>
            <span v-else>Drag & drop files here, or click to select</span>
          </p>
          <p
            v-if="allowedTypesString"
            class="text-copy-sm"
          >
            ({{ allowedTypesString }})
          </p>
          <DButton
            variant="secondary"
            size="sm"
            class="pointer-events-none mt-2"
            tabindex="-1"
          >
            Select Files
          </DButton>
        </div>
      </button>
      <div
        class="mt-1 flex justify-end p-1"
        v-if="field.maxValue"
      >
        <p
          class="text-copy-sm text-neutral-subtle flex gap-0.5 rounded-md px-2 py-0.5"
          :class="[isMaxReached ? 'bg-warn text-warn-onsurface' : '']"
          aria-live="polite"
        >
          <span
            class="mr-1"
            v-if="isMaxReached"
          >
            Limit reached:
          </span>
          <span :class="[isMaxReached ? '' : 'text-neutral font-medium']">
            {{ sortedAssets.length }}
          </span>
          <span>/</span>
          <span>
            {{ field.maxValue }}
          </span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assets-container {
  background: var(--background-color-neutral-weak) url("/stripes.svg");
  background-blend-mode: overlay;
}

.sortable-drag {
  opacity: 0.9;
  background-color: var(--background-color-neutral-weak);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.sortable-ghost {
  opacity: 0.4;
  background-color: var(--background-color-neutral-subtle);
  border-radius: 8px;
}
</style>
