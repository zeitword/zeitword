<script setup lang="ts">
definePageMeta({
  layout: "site"
})

const route = useRoute()
const siteId = computed(() => route.params.siteId as string)
const folderId = computed(() => route.params.folderId as string | undefined)

const { toast } = useToast()

const { data: components } = await useFetch(`/api/sites/${siteId.value}/components`)

const { data: currentFolder, error: folderError } = await useFetch(
  `/api/sites/${siteId.value}/stories/${folderId.value}`
)

if (folderError.value) {
  toast.error({ description: "Failed to load folder details." })
  console.error("Folder fetch error:", folderError.value)
}

const {
  data: stories,
  refresh: refreshStories,
  error: listError
} = await useAsyncData(
  `stories-${folderId.value || "root"}`,
  () =>
    folderId.value
      ? $fetch(`/api/sites/${siteId.value}/stories/${folderId.value}/children`)
      : $fetch(`/api/sites/${siteId.value}/stories`),
  { watch: [folderId] }
)

if (listError.value) {
  toast.error({ description: "Failed to load content list." })
  console.error("List fetch error:", listError.value)
}

const isCreateModalOpen = ref(false)
const itemTypeToCreate = ref<"story" | "folder">("story")
const name = ref("")
const slug = ref("")
const contentType = ref("")

const isDeleteModalOpen = ref(false)
const selectedStoryId = ref<string | null>(null)

// --- Computed Properties ---
const contentTypeOptions = computed(() => {
  return (
    components.value?.map((component) => ({
      display: component.displayName,
      value: component.id
    })) || []
  )
})
const pageTitle = computed(() => currentFolder.value?.title || "Content")
const parentSlug = computed(() => currentFolder.value?.slug || "/")

// --- Actions ---
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

  if (
    (itemTypeToCreate.value === "folder" && slug.value === "") ||
    (itemTypeToCreate.value === "story" && folderId.value && slug.value === "")
  ) {
    if (itemTypeToCreate.value === "story" && !folderId.value && slug.value === "") {
    } else {
      return toast.info({ description: "Please enter a slug" })
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value) && slug.value !== "") {
    return toast.warning({ description: "Slug must be lowercase alphanumeric with hyphens." })
  }

  try {
    let finalSlug: string
    const currentSlugInput = slug.value

    if (folderId.value) {
      if (!currentFolder.value?.slug) throw new Error("Cannot determine parent path.")
      finalSlug = `${currentFolder.value.slug}/${currentSlugInput}`
    } else {
      if (itemTypeToCreate.value === "story") {
        finalSlug = currentSlugInput.length > 0 ? currentSlugInput : "index"
      } else {
        if (currentSlugInput.length === 0) {
          return toast.info({ description: "Folder slug cannot be empty at the root level." })
        }
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
      body.componentId = contentType.value
    }

    await $fetch(`/api/sites/${siteId.value}/stories`, {
      method: "POST",
      body: body
    })

    closeCreateModal()
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
    await refreshStories()
  } catch (error: any) {
    console.error(error)
    toast.error({ description: "Failed to delete item." })
  } finally {
    selectedStoryId.value = null
    isDeleteModalOpen.value = false
  }
}

function handleApiError(error: any, itemType: "story" | "folder") {
  console.error(`Error creating ${itemType}:`, error)
  if (error.response && error.response.status === 409) {
    toast.error({
      description: error.response._data?.statusMessage || `Slug conflict creating ${itemType}.`
    })
  } else if (error.response?.data?.message) {
    toast.error({ description: `Invalid input: ${error.response.data.message}` })
  } else {
    toast.error({ description: `Failed to create ${itemType}.` })
  }
}
</script>
<template>
  <DPageTitle :title="pageTitle">
    <template
      #subtitle
      v-if="currentFolder"
    >
      <p class="text-copy-sm text-neutral-subtle">{{ currentFolder.slug }}</p>
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
      <DStoryList
        :stories="stories || []"
        :site-id="siteId"
        :parent-slug="parentSlug"
        @delete-story="openDeleteModal"
        @create-story="openCreateModal('story')"
        @create-folder="openCreateModal('folder')"
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
          :leading="parentSlug === '/' ? '/' : '/' + parentSlug + '/'"
          :placeholder="
            itemTypeToCreate === 'folder' ? 'blog-posts' : folderId ? 'sub-page' : 'index'
          "
          :required="itemTypeToCreate === 'folder' || !!folderId"
        />
        <p
          v-if="itemTypeToCreate === 'story' && !folderId"
          class="text-copy-xs text-neutral-subtle mt-1"
        >
          Leave empty for root "index".
        </p>
        <p
          v-if="itemTypeToCreate === 'folder' || !!folderId"
          class="text-copy-xs text-neutral-subtle mt-1"
        >
          Lowercase letters, numbers, and hyphens.
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
