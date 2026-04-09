<script setup lang="ts">
import { useDropZone, useEventListener } from "@vueuse/core"
import {
  ImageIcon,
  FilmIcon,
  MusicIcon,
  FileIcon,
  FileTextIcon,
  Trash2Icon,
  UploadCloudIcon,
  LoaderCircleIcon,
  CopyIcon,
  CheckIcon,
  SearchIcon,
  XIcon
} from "lucide-vue-next"

import type { DAsset } from "~/types/models"

import { useUpload } from "~/composables/useUpload"

definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")
const { toast } = useToast()

// Search and filter state
const search = ref("")
const typeFilter = ref("")
const offset = ref(0)
const limit = 50

const debouncedSearch = refDebounced(search, 300)

// Fetch assets
const { data: assetsResponse, refresh } = await useFetch(
  () => `/api/sites/${siteId.value}/assets`,
  {
    query: computed(() => ({
      search: debouncedSearch.value || undefined,
      type: typeFilter.value || undefined,
      offset: offset.value,
      limit
    })),
    watch: [debouncedSearch, typeFilter, offset]
  }
)

const assets = computed(() => assetsResponse.value?.data ?? [])
const pagination = computed(() => assetsResponse.value?.pagination)

// Reset offset when search or filter changes
watch([debouncedSearch, typeFilter], () => {
  offset.value = 0
})

// Upload state
const isUploading = ref(false)
const uploadProgress = ref(0)
const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

useDropZone(dropZoneRef, {
  onDrop: (files) => {
    isDragging.value = false
    if (files) {
      uploadFiles(Array.from(files))
    }
  },
  onEnter: () => {
    isDragging.value = true
  },
  onLeave: () => {
    isDragging.value = false
  }
})

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

    toast.success({ description: `${files.length === 1 ? "File" : `${files.length} files`} uploaded successfully` })
    await refresh()
  } catch (error) {
    console.error(error)
    toast.error({ description: "Upload failed" })
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
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

// Asset detail / permalink
const selectedAsset = ref<DAsset | null>(null)
const copiedId = ref<string | null>(null)

useEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape" && selectedAsset.value) {
    selectedAsset.value = null
  }
})

function selectAsset(asset: DAsset) {
  selectedAsset.value = selectedAsset.value?.id === asset.id ? null : asset
}

async function copyPermalink(asset: DAsset) {
  try {
    await navigator.clipboard.writeText(asset.src)
    copiedId.value = asset.id
    toast.success({ description: "Permalink copied to clipboard" })
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch {
    toast.error({ description: "Failed to copy permalink" })
  }
}

// Delete
const isDeleteModalOpen = ref(false)
const assetToDelete = ref<DAsset | null>(null)

function showDeleteModal(asset: DAsset) {
  assetToDelete.value = asset
  isDeleteModalOpen.value = true
}

async function deleteAsset() {
  if (!assetToDelete.value) return
  try {
    await $fetch(`/api/sites/${siteId.value}/assets/${assetToDelete.value.id}`, {
      method: "DELETE"
    })
    toast.success({ description: "Asset deleted" })
    if (selectedAsset.value?.id === assetToDelete.value.id) {
      selectedAsset.value = null
    }
    await refresh()
  } catch {
    toast.error({ description: "Failed to delete asset" })
  } finally {
    assetToDelete.value = null
    isDeleteModalOpen.value = false
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

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

const typeFilters = [
  { value: "", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "pdf", label: "PDF" },
  { value: "other", label: "Other" }
]
</script>

<template>
  <DPageTitle title="Media">
    <DButton @click="openFilePicker">Upload Files</DButton>
  </DPageTitle>

  <DPageWrapper>
    <div class="py-5">
      <!-- Upload drop zone -->
      <div
        ref="dropZoneRef"
        class="border-neutral bg-neutral relative mb-6 rounded-lg border border-dashed transition-colors"
        :class="[
          isDragging ? 'border-accent bg-accent-subtle' : '',
          isUploading ? 'pointer-events-none opacity-75' : ''
        ]"
      >
        <button
          class="flex w-full cursor-pointer flex-col items-center justify-center px-6 py-8"
          @click="!isUploading && openFilePicker()"
        >
          <div v-if="isUploading" class="flex flex-col items-center">
            <LoaderCircleIcon class="text-neutral-subtle mb-2 size-6 animate-spin" />
            <p class="text-copy text-neutral-subtle">
              Uploading{{ uploadProgress > 0 ? ` ${uploadProgress}%` : "..." }}
            </p>
            <div
              v-if="uploadProgress > 0"
              class="bg-neutral-strong mt-2 h-1 w-40 overflow-hidden rounded-full"
            >
              <div
                class="bg-neutral-inverse h-full transition-all duration-300"
                :style="{ width: `${uploadProgress}%` }"
              />
            </div>
          </div>

          <div v-else class="flex flex-col items-center">
            <UploadCloudIcon class="text-neutral-subtle mb-2 size-6" />
            <p class="text-copy text-neutral">
              <span v-if="isDragging">Drop files to upload</span>
              <span v-else>Drag & drop files here, or click to browse</span>
            </p>
          </div>
        </button>
      </div>

      <!-- Search and filter bar -->
      <div class="mb-4 flex items-center gap-3">
        <div class="relative flex-1">
          <DInput
            v-model="search"
            placeholder="Search by file name..."
            name="search"
          >
            <template #leading>
              <SearchIcon class="size-4" />
            </template>
          </DInput>
        </div>
        <div class="flex gap-1">
          <DButton
            v-for="filter in typeFilters"
            :key="filter.value"
            :variant="typeFilter === filter.value ? 'primary' : 'secondary'"
            size="sm"
            @click="typeFilter = filter.value"
          >
            {{ filter.label }}
          </DButton>
        </div>
      </div>

      <!-- Asset grid -->
      <div
        v-if="assets.length > 0"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        <div
          v-for="asset in assets"
          :key="asset.id"
          class="border-neutral bg-neutral group relative cursor-pointer overflow-hidden rounded-lg border transition-all"
          :class="[selectedAsset?.id === asset.id ? 'ring-2 ring-blue-500' : 'hover:border-neutral-strong']"
          @click="selectAsset(asset)"
        >
          <!-- Thumbnail -->
          <div class="bg-neutral-subtle relative aspect-square overflow-hidden">
            <NuxtImg
              v-if="asset.type === 'image'"
              :src="asset.src"
              :alt="asset.fileName"
              width="200"
              height="200"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center"
            >
              <component
                :is="getAssetIcon(asset.type)"
                class="text-neutral-subtle size-10"
              />
            </div>

            <!-- Hover overlay -->
            <div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <DButton
                variant="secondary"
                size="sm"
                :icon-left="CopyIcon"
                @click.stop="copyPermalink(asset)"
              />
              <DButton
                variant="secondary"
                size="sm"
                :icon-left="Trash2Icon"
                @click.stop="showDeleteModal(asset)"
              />
            </div>
          </div>

          <!-- Info -->
          <div class="px-2 py-2">
            <p class="text-copy-sm text-neutral truncate" :title="asset.fileName">
              {{ asset.fileName }}
            </p>
            <p class="text-copy-xs text-neutral-subtle">
              {{ formatBytes(asset.fileSize) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <DEmpty
        v-else-if="!isUploading"
        title="No assets yet"
        :description="search || typeFilter ? 'No assets match your search' : 'Upload files to get started'"
        :icon="ImageIcon"
        size="lg"
      >
        <DButton
          v-if="!search && !typeFilter"
          variant="secondary"
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

      <!-- Selected asset detail panel -->
      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="translate-y-4 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-4 opacity-0"
      >
        <div
          v-if="selectedAsset"
          class="border-neutral bg-neutral fixed right-6 bottom-6 z-50 w-96 overflow-hidden rounded-xl border shadow-lg"
        >
          <div class="flex items-center justify-between border-b border-neutral px-4 py-3">
            <h3 class="text-copy text-neutral truncate font-medium">
              {{ selectedAsset.fileName }}
            </h3>
            <button
              class="text-neutral-subtle hover:text-neutral cursor-pointer rounded-md p-1 transition-colors hover:bg-neutral-subtle"
              @click="selectedAsset = null"
            >
              <XIcon class="size-4" />
            </button>
          </div>

          <!-- Preview -->
          <div class="bg-neutral-subtle border-b border-neutral">
            <div class="flex items-center justify-center p-4">
              <NuxtImg
                v-if="selectedAsset.type === 'image'"
                :src="selectedAsset.src"
                :alt="selectedAsset.fileName"
                width="400"
                height="300"
                class="max-h-48 rounded-md object-contain"
              />
              <div v-else class="flex flex-col items-center gap-2 py-6">
                <component
                  :is="getAssetIcon(selectedAsset.type)"
                  class="text-neutral-subtle size-12"
                />
                <span class="text-copy-sm text-neutral-subtle capitalize">
                  {{ selectedAsset.type }} file
                </span>
              </div>
            </div>
          </div>

          <!-- Details -->
          <div class="space-y-3 p-4">
            <!-- Permalink -->
            <div>
              <label class="text-copy-xs text-neutral-subtle mb-1 block">Permalink</label>
              <div class="flex gap-2">
                <div
                  class="bg-neutral-subtle border-neutral text-copy-sm text-neutral flex-1 truncate rounded-md border px-2.5 py-1.5"
                  :title="selectedAsset.src"
                >
                  {{ selectedAsset.src }}
                </div>
                <DButton
                  variant="secondary"
                  size="sm"
                  :icon-left="copiedId === selectedAsset.id ? CheckIcon : CopyIcon"
                  @click="copyPermalink(selectedAsset)"
                />
              </div>
            </div>

            <!-- Meta -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-copy-xs text-neutral-subtle mb-0.5 block">Type</label>
                <p class="text-copy-sm text-neutral capitalize">{{ selectedAsset.type }}</p>
              </div>
              <div>
                <label class="text-copy-xs text-neutral-subtle mb-0.5 block">Size</label>
                <p class="text-copy-sm text-neutral">{{ formatBytes(selectedAsset.fileSize) }}</p>
              </div>
              <div>
                <label class="text-copy-xs text-neutral-subtle mb-0.5 block">MIME Type</label>
                <p class="text-copy-sm text-neutral">{{ selectedAsset.contentType }}</p>
              </div>
              <div>
                <label class="text-copy-xs text-neutral-subtle mb-0.5 block">Uploaded</label>
                <p class="text-copy-sm text-neutral">{{ formatDate(selectedAsset.createdAt) }}</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-1">
              <DButton
                variant="secondary"
                size="sm"
                :icon-left="CopyIcon"
                class="flex-1"
                @click="copyPermalink(selectedAsset)"
              >
                Copy URL
              </DButton>
              <DButton
                variant="danger"
                size="sm"
                :icon-left="Trash2Icon"
                @click="showDeleteModal(selectedAsset)"
              >
                Delete
              </DButton>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </DPageWrapper>

  <!-- Delete confirmation modal -->
  <DModal
    :open="isDeleteModalOpen"
    title="Delete Asset"
    description="This asset will be soft-deleted. Existing references in stories will continue to work."
    confirm-text="Delete Asset"
    danger
    @confirm="deleteAsset"
    @close="isDeleteModalOpen = false"
  />
</template>
