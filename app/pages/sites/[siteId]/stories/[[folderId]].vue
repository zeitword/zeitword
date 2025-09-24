<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useDebounceFn } from "@vueuse/core"
import type { Item as StoryListItem } from "~/components/d-story-list/index.vue"
import { SearchIcon } from "lucide-vue-next"
import type { Pagination } from "~/types/pagination"

definePageMeta({
  layout: "site"
})

const route = useRoute()
const siteId = computed(() => route.params.siteId as string)
const folderId = computed(() => route.params.folderId as string | undefined)

const { toast } = useToast()

const searchInput = ref("")
const debouncedSearchQuery = ref("")
const isSearching = computed(() => !!debouncedSearchQuery.value)
const offset = ref(0)

const updateSearchQuery = useDebounceFn((value: string) => {
  debouncedSearchQuery.value = value
  offset.value = 0
}, 300)

watch(searchInput, (newValue) => {
  updateSearchQuery(newValue)
})

const { data: components } = await useFetch(`/api/sites/${siteId.value}/components`)

const { data: currentFolder, error: folderError } = await useFetch(
  () => (folderId.value ? `/api/sites/${siteId.value}/stories/${folderId.value}` : null),
  {
    watch: [folderId],
    default: () => null
  }
)

if (folderError.value) {
  if (folderId.value) {
    toast.error({ description: "Failed to load folder details." })
    console.error("Folder fetch error:", folderError.value)
  }
}

const {
  data: storiesData,
  refresh: refreshStories,
  error: listError
} = await useAsyncData<{ data: StoryListItem[]; pagination: Pagination }>(
  `stories-${siteId.value}-${folderId.value || "root"}-${debouncedSearchQuery.value}`,
  async (): Promise<{ data: StoryListItem[]; pagination: Pagination }> => {
    const params = {
      offset: offset.value,
      limit: 50
    }

    if (debouncedSearchQuery.value) {
      return await $fetch<{ data: StoryListItem[]; pagination: Pagination }>(
        `/api/sites/${siteId.value}/stories`,
        {
          params: { search: debouncedSearchQuery.value, ...params }
        }
      )
    } else if (folderId.value) {
      return await $fetch<{ data: StoryListItem[]; pagination: Pagination }>(
        `/api/sites/${siteId.value}/stories/${folderId.value}/children`,
        {
          params
        }
      )
    } else {
      return await $fetch<{ data: StoryListItem[]; pagination: Pagination }>(
        `/api/sites/${siteId.value}/stories`,
        {
          params
        }
      )
    }
  },
  {
    watch: [folderId, debouncedSearchQuery, offset],
    default: () => ({
      data: [],
      pagination: { offset: 0, limit: 0, total: 0, hasNext: false, hasPrev: false }
    })
  }
)

const stories = computed(() => storiesData.value.data)
const pagination = computed(() => storiesData.value.pagination)

if (listError.value) {
  toast.error({ description: "Failed to load content list." })
  console.error("List fetch error:", listError.value)
}

const sortedDisplayItems = computed(() => {
  const itemsToSort = stories.value || []
  const currentParentSlug = parentSlugForDisplay.value
  const searching = isSearching.value

  return [...itemsToSort].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1
    if (a.type !== "folder" && b.type === "folder") return 1

    const getComparisonSlug = (itemSlug: string): string => {
      if (searching) {
        return itemSlug
      }
      const parent = currentParentSlug || "/"
      if (parent === "/") {
        return itemSlug
      }
      const parentPrefix = parent.endsWith("/") ? parent : parent + "/"
      if (itemSlug.startsWith(parentPrefix)) {
        const relative = itemSlug.substring(parentPrefix.length)
        return relative === "" && itemSlug === parent ? "index" : relative
      }
      return itemSlug
    }

    const aCompSlug = getComparisonSlug(a.slug)
    const bCompSlug = getComparisonSlug(b.slug)

    if (!searching && a.type === "story" && b.type === "story") {
      if (aCompSlug === "index" && bCompSlug !== "index") return -1
      if (aCompSlug !== "index" && bCompSlug === "index") return 1
    }

    return aCompSlug.localeCompare(bCompSlug)
  })
})

const isCreateModalOpen = ref(false)
const itemTypeToCreate = ref<"story" | "folder">("story")
const name = ref("")
const slug = ref("")
const contentType = ref("")
const isDeleteModalOpen = ref(false)
const selectedStoryId = ref<string | null>(null)

const contentTypeOptions = computed(() => {
  return (
    components.value?.map((component) => ({
      display: component.displayName,
      value: component.id
    })) || []
  )
})
const pageTitle = computed(() => currentFolder.value?.title || "Content")
const parentSlugForDisplay = computed(() => currentFolder.value?.slug || "/")

function handleNavigation(item: StoryListItem) {
  if (item.type === "story") {
    navigateTo(`/sites/${siteId.value}/stories/story/${item.id}/content`)
  } else {
    navigateTo(`/sites/${siteId.value}/stories/${item.id}`)
  }
}

function openCreateModal(type: "story" | "folder") {
  itemTypeToCreate.value = type
  name.value = ""
  slug.value = ""
  contentType.value = ""
  isCreateModalOpen.value = true
}

function closeCreateModal() {
  isCreateModalOpen.value = false
}

async function createItem() {
  if (name.value === "") return toast.info({ description: "Please enter a name" })

  if (itemTypeToCreate.value === "story" && contentType.value === "") {
    return toast.info({ description: "Please select a content type for the story" })
  }

  const slugIsRequired = itemTypeToCreate.value === "folder" || !!folderId.value

  if (slugIsRequired && slug.value === "") {
    return toast.info({ description: "Please enter a slug" })
  }
  if (!slugIsRequired && slug.value === "" && itemTypeToCreate.value === "folder") {
    return toast.info({ description: "Folder slug cannot be empty at the root level." })
  }
  if (slug.value !== "" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) {
    return toast.warning({ description: "Slug must be lowercase alphanumeric with hyphens." })
  }

  try {
    let finalSlug: string
    const currentSlugInput =
      slug.value || (itemTypeToCreate.value === "story" && !folderId.value ? "index" : "")
    const baseSlug = folderId.value ? currentFolder.value?.slug : null

    if (baseSlug) {
      if (!currentSlugInput)
        throw new Error("Slug is required when creating items inside a folder.")
      finalSlug = `${baseSlug}/${currentSlugInput}`
    } else {
      if (itemTypeToCreate.value === "story") {
        finalSlug = currentSlugInput
      } else {
        if (!currentSlugInput) throw new Error("Folder slug is required at the root level.")
        finalSlug = currentSlugInput
      }
    }

    const body: {
      type: "story" | "folder"
      slug: string
      title: string
      componentId?: string
      content?: object
    } = {
      type: itemTypeToCreate.value,
      slug: finalSlug,
      title: name.value,
      content: {}
    }
    if (itemTypeToCreate.value === "story") {
      if (!contentType.value) throw new Error("Content type is required for stories.")
      body.componentId = contentType.value
    }

    await $fetch(`/api/sites/${siteId.value}/stories`, { method: "POST", body: body })
    closeCreateModal()
    searchInput.value = ""
    await refreshStories()
    toast.success({
      description: `${itemTypeToCreate.value.charAt(0).toUpperCase() + itemTypeToCreate.value.slice(1)} created successfully.`
    })
  } catch (error: any) {
    handleApiError(error, itemTypeToCreate.value)
  }
}

function openDeleteModal(storyIdToDelete: string) {
  selectedStoryId.value = storyIdToDelete
  isDeleteModalOpen.value = true
}

async function deleteStory() {
  if (!selectedStoryId.value) return
  try {
    await $fetch(`/api/sites/${siteId.value}/stories/${selectedStoryId.value}`, {
      method: "DELETE"
    })
    toast.success({ description: "Item deleted successfully" })
    searchInput.value = ""
    await refreshStories()
  } catch (error: any) {
    console.error(error)
    if (error.response?._data?.message?.includes("Cannot delete folder with children")) {
      toast.error({ description: "Cannot delete folder: Please delete its contents first." })
    } else {
      toast.error({ description: "Failed to delete item." })
    }
  } finally {
    selectedStoryId.value = null
    isDeleteModalOpen.value = false
  }
}

function handleApiError(error: any, itemType: "story" | "folder") {
  console.error(`Error creating ${itemType}:`, error)
  if (error.response && error.response.status === 409) {
    toast.error({
      description:
        error.response._data?.statusMessage ||
        `A story or folder with this slug already exists in this location.`
    })
  } else if (error.response?.data?.message) {
    toast.error({ description: `Invalid input: ${error.response.data.message}` })
  } else {
    toast.error({ description: `Failed to create ${itemType}. ${error.message || ""}` })
  }
}
</script>

<template>
  <DPageTitle :title="pageTitle">
    <template
      #subtitle
      v-if="folderId && currentFolder"
    >
      <p class="text-copy-sm text-neutral-subtle">/{{ currentFolder.slug }}</p>
    </template>
    <div class="flex gap-2">
      <DButton
        variant="secondary"
        @click="openCreateModal('folder')"
      >
        Add Folder
      </DButton>
      <DButton @click="openCreateModal('story')">Add Story</DButton>
    </div>
  </DPageTitle>

  <DPageWrapper>
    <div class="py-5">
      <div class="mb-4">
        <DInput
          v-model="searchInput"
          placeholder="Search stories and folders..."
          :icon-left="SearchIcon"
        />
      </div>

      <div
        v-if="listError"
        class="text-destructive p-4 text-center"
      >
        Failed to load items.
        <DButton
          variant="secondary"
          size="sm"
          @click="refreshStories"
        >
          Retry
        </DButton>
      </div>
      <DStoryList
        v-else
        :stories="sortedDisplayItems"
        :is-searching="isSearching"
        :parent-slug="parentSlugForDisplay"
        @delete-story="openDeleteModal"
        @create-story="openCreateModal('story')"
        @create-folder="openCreateModal('folder')"
        @navigate="handleNavigation"
        :search-term="debouncedSearchQuery"
      />

      <DPagination
        v-bind="pagination"
        v-model:offset="offset"
      />
    </div>
  </DPageWrapper>

  <DModal
    :open="isCreateModalOpen"
    :title="`New ${itemTypeToCreate === 'story' ? 'Content Story' : 'Folder'}`"
    :confirm-text="`Create ${itemTypeToCreate === 'story' ? 'Story' : 'Folder'}`"
    @close="closeCreateModal"
    @confirm="createItem"
  >
    <form
      @submit.prevent="createItem"
      class="flex w-full flex-col gap-4"
    >
      <DFormGroup>
        <DFormLabel
          name="name"
          required
        >
          Name
        </DFormLabel>
        <DInput
          id="name"
          name="name"
          v-model="name"
          required
          :placeholder="`e.g. ${itemTypeToCreate === 'story' ? 'About Us' : 'Blog Posts'}`"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel
          name="slug"
          :required="itemTypeToCreate === 'folder' || !!folderId"
        >
          Slug
        </DFormLabel>
        <DInput
          id="slug"
          name="slug"
          v-model.slug="slug"
          :leading="parentSlugForDisplay === '/' ? '/' : `/${parentSlugForDisplay}/`"
          :placeholder="
            itemTypeToCreate === 'folder' ? 'folder-name' : folderId ? 'sub-page-slug' : 'index'
          "
          :required="itemTypeToCreate === 'folder' || !!folderId"
        />
        <p
          v-if="itemTypeToCreate === 'story' && !folderId"
          class="text-copy-xs text-neutral-subtle mt-1"
        >
          Leave empty for the root page (slug will be "index").
        </p>
        <p
          v-else
          class="text-copy-xs text-neutral-subtle mt-1"
        >
          Required. Lowercase letters, numbers, and hyphens only.
        </p>
      </DFormGroup>
      <DFormGroup v-if="itemTypeToCreate === 'story'">
        <DFormLabel
          name="contentType"
          required
        >
          Content Type
        </DFormLabel>
        <DSelect
          id="contentType"
          name="contentType"
          v-model="contentType"
          required
          placeholder="Select Type"
          :options="contentTypeOptions"
        />
      </DFormGroup>
    </form>
  </DModal>

  <DModal
    :open="isDeleteModalOpen"
    title="Delete Item"
    description="Are you sure? This action cannot be undone. If it's a folder, all its contents will also be deleted."
    confirm-text="Delete"
    danger
    @confirm="deleteStory"
    @close="isDeleteModalOpen = false"
  ></DModal>
</template>
