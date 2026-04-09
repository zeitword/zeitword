<script setup lang="ts">
import {
  ImageIcon,
  FilmIcon,
  MusicIcon,
  FileIcon,
  FileTextIcon,
  SearchIcon,
  CheckIcon,
  UploadCloudIcon,
  LoaderCircleIcon
} from "lucide-vue-next"

import type { DAsset } from "~/types/models"
import type { AssetType } from "~/types"

import { useUpload } from "~/composables/useUpload"

type Props = {
  open: boolean
  multiple?: boolean
  assetTypes?: AssetType[]
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  assetTypes: undefined
})

const emit = defineEmits<{
  (e: "close"): void
  (e: "select", assets: DAsset[]): void
}>()

const siteId = useRouteParams("siteId")
const { toast } = useToast()

// Search and filter state
const search = ref("")
const typeFilter = ref("")
const offset = ref(0)
const limit = 24

const debouncedSearch = refDebounced(search, 300)

// Selection state
const selected = ref<Map<string, DAsset>>(new Map())

// Upload state
const isUploading = ref(false)
const uploadProgress = ref(0)

// Fetch assets
const { data: assetsResponse, refresh } = useFetch(
  () => `/api/sites/${siteId.value}/assets`,
  {
    query: computed(() => ({
      search: debouncedSearch.value || undefined,
      type: typeFilter.value || undefined,
      offset: offset.value,
      limit
    })),
    watch: [debouncedSearch, typeFilter, offset],
    immediate: false
  }
)

const assets = computed(() => assetsResponse.value?.data ?? [])
const pagination = computed(() => assetsResponse.value?.pagination)

// Reset state when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selected.value = new Map()
      search.value = ""
      typeFilter.value = ""
      offset.value = 0
      refresh()
    }
  }
)

// Reset offset when search or filter changes
watch([debouncedSearch, typeFilter], () => {
  offset.value = 0
})

function isSelected(asset: DAsset): boolean {
  return selected.value.has(asset.id)
}

function toggleSelect(asset: DAsset) {
  if (props.multiple) {
    const newSelected = new Map(selected.value)
    if (newSelected.has(asset.id)) {
      newSelected.delete(asset.id)
    } else {
      newSelected.set(asset.id, asset)
    }
    selected.value = newSelected
  } else {
    // Single select: toggle or replace
    if (selected.value.has(asset.id)) {
      selected.value = new Map()
    } else {
      selected.value = new Map([[asset.id, asset]])
    }
  }
}

function confirmSelection() {
  const selectedAssets = Array.from(selected.value.values())
  if (selectedAssets.length === 0) return
  emit("select", selectedAssets)
  emit("close")
}

function openFilePicker() {
  const input = document.createElement("input")
  input.type = "file"
  input.multiple = true
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files
    if (files && files.length > 0) {
      uploadFiles(Array.from(files))
    }
  }
  input.click()
}

async function uploadFiles(files: File[]) {
  isUploading.value = true
  uploadProgress.value = 0

  try {
    for (const file of files) {
      const { uploadFile: doUpload } = useUpload({
        maxRetries: 3,
        onProgress: (progress) => {
          uploadProgress.value = progress.overallProgress
        }
      })

      await doUpload(file, { siteId: siteId.value })
    }

    toast.success({
      description: `${files.length === 1 ? "File" : `${files.length} files`} uploaded successfully`
    })
    await refresh()
  } catch (error) {
    console.error(error)
    toast.error({ description: "Upload failed" })
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// Helpers
function getAssetIcon(type: string) {
  switch (type) {
    case "image":
      return ImageIcon
    case "video":
      return FilmIcon
    case "audio":
      return MusicIcon
    case "pdf":
      return FileTextIcon
    default:
      return FileIcon
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const typeFilters = [
  { value: "", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "pdf", label: "PDF" },
  { value: "other", label: "Other" }
]

const confirmLabel = computed(() => {
  const count = selected.value.size
  if (count === 0) return "Select"
  if (props.multiple) return `Select ${count} ${count === 1 ? "file" : "files"}`
  return "Select"
})
</script>

<template>
  <DModal
    :open="open"
    title="Media Library"
    :confirm-text="confirmLabel"
    size="4xl"
    @close="emit('close')"
    @confirm="confirmSelection"
  >
    <div class="flex flex-col gap-4">
      <!-- Search, filter, upload bar -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <DInput
            v-model="search"
            placeholder="Search by file name..."
            name="picker-search"
          >
            <template #leading>
              <SearchIcon class="size-4" />
            </template>
          </DInput>
        </div>
        <DButton
          variant="secondary"
          size="sm"
          :icon-left="isUploading ? LoaderCircleIcon : UploadCloudIcon"
          :disabled="isUploading"
          @click="openFilePicker"
        >
          {{ isUploading ? `Uploading ${uploadProgress}%` : "Upload" }}
        </DButton>
      </div>

      <!-- Type filter -->
      <div class="flex gap-1">
        <DButton
          v-for="filter in typeFilters"
          :key="filter.value"
          :variant="typeFilter === filter.value ? 'primary' : 'secondary'"
          size="xs"
          @click="typeFilter = filter.value"
        >
          {{ filter.label }}
        </DButton>
      </div>

      <!-- Asset grid -->
      <div
        v-if="assets.length > 0"
        class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
      >
        <button
          v-for="asset in assets"
          :key="asset.id"
          class="border-neutral bg-neutral group relative cursor-pointer overflow-hidden rounded-lg border transition-all"
          :class="[
            isSelected(asset)
              ? 'ring-2 ring-blue-500 border-blue-500'
              : 'hover:border-neutral-strong'
          ]"
          @click="toggleSelect(asset)"
        >
          <!-- Selection indicator -->
          <div
            v-if="isSelected(asset)"
            class="absolute top-1.5 right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-blue-500"
          >
            <CheckIcon class="size-3 text-white" />
          </div>

          <!-- Thumbnail -->
          <div class="bg-neutral-subtle relative aspect-square overflow-hidden">
            <NuxtImg
              v-if="asset.type === 'image'"
              :src="asset.src"
              :alt="asset.fileName"
              width="150"
              height="150"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center"
            >
              <component
                :is="getAssetIcon(asset.type)"
                class="text-neutral-subtle size-8"
              />
            </div>
          </div>

          <!-- Info -->
          <div class="px-2 py-1.5">
            <p
              class="text-copy-xs text-neutral truncate"
              :title="asset.fileName"
            >
              {{ asset.fileName }}
            </p>
            <p class="text-copy-xs text-neutral-subtle">
              {{ formatBytes(asset.fileSize) }}
            </p>
          </div>
        </button>
      </div>

      <!-- Empty state -->
      <DEmpty
        v-else
        title="No assets found"
        :description="
          search || typeFilter
            ? 'No assets match your search'
            : 'Upload files to get started'
        "
        :icon="ImageIcon"
      >
        <DButton
          v-if="!search && !typeFilter"
          variant="secondary"
          size="sm"
          @click="openFilePicker"
        >
          Upload Files
        </DButton>
      </DEmpty>

      <!-- Pagination -->
      <DPagination
        v-if="pagination && pagination.total > limit"
        v-model:offset="offset"
        :total="pagination.total"
        :limit="limit"
      />
    </div>
  </DModal>
</template>
