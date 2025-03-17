// zeitword/app/pages/sites/[siteId]/content/index.vue
<script setup lang="ts">
import DStoryList from "~/components/d-story-list/index.vue" // Import the component

definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")

const { data: components } = await useFetch(`/api/sites/${siteId.value}/components`)
const { data: stories, refresh: refreshStories } = await useFetch(
  `/api/sites/${siteId.value}/stories`
)

const isCreateModalOpen = ref(false)

const contentTypeOptions = computed(() => {
  if (!components.value) return
  return components.value.map((component) => ({
    display: component.displayName,
    value: component.id
  }))
})

const name = ref("")
const slug = ref("")
const contentType = ref("")
const parentSlug = ref("/")

const isDeleteModalOpen = ref(false)
const selectedStoryId = ref<string | null>(null)

const { toast } = useToast()

async function createStory() {
  if (name.value === "") return toast.info({ description: "Please enter a name" })
  if (contentType.value === "") return toast.info({ description: "Please select a content type" })
  try {
    await $fetch(`/api/sites/${siteId.value}/stories`, {
      method: "POST",
      body: {
        slug: slug.value.length > 0 ? slug.value : "index",
        title: name.value,
        content: {},
        componentId: contentType.value
      }
    })
    closeCreateModal()
    refreshStories()
  } catch (error: any) {
    console.error(error)
    if (error.response && error.response.status === 409) {
      toast.error({ description: error.response._data.statusMessage })
    }
  }
}

function openCreateModal(storyId: string) {
  selectedStoryId.value = storyId
  isCreateModalOpen.value = true
}

function closeCreateModal() {
  name.value = ""
  slug.value = ""
  contentType.value = ""
  isCreateModalOpen.value = false
}

function openDeleteModal(storyId: string) {
  selectedStoryId.value = storyId
  isDeleteModalOpen.value = true
}

async function deleteStory() {
  try {
    if (!selectedStoryId.value) return
    await $fetch(`/api/sites/${siteId.value}/stories/${selectedStoryId.value}`, {
      method: "DELETE"
    })

    toast.success({ description: "Story deleted successfully" })
    refreshStories()
  } catch (error: any) {
    console.error(error)
  } finally {
    selectedStoryId.value = null
    isDeleteModalOpen.value = false
  }
}

const topLevelStories = computed(() => {
  return stories.value?.filter((story) => !story.slug.includes("/")) || []
})
</script>

<template>
  <DPageTitle title="Content">
    <DButton @click="isCreateModalOpen = true">Add Story</DButton>
  </DPageTitle>
  <DPageWrapper>
    <div class="py-5">
      <DStoryList
        v-if="topLevelStories"
        :stories="topLevelStories"
        @delete-story="openDeleteModal($event)"
        @create-story="openCreateModal($event)"
      />
    </div>
  </DPageWrapper>

  <DModal
    :open="isCreateModalOpen"
    title=" New Content Story "
    confirm-text="Create Story"
    @close="closeCreateModal"
    @confirm="createStory"
  >
    <form
      @submit.prevent="createStory"
      class="flex w-full flex-col gap-4 p-5"
    >
      <DFormGroup>
        <DFormLabel
          name="domain"
          required
        >
          Name
        </DFormLabel>
        <DInput
          id="name"
          name="name"
          v-model="name"
          required
          placeholder="e.g. Landing"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel
          name="slug"
          required
        >
          Slug
        </DFormLabel>
        <DInput
          id="slug"
          name="slug"
          v-model.slug="slug"
          required
          :leading="parentSlug"
          placeholder="landing"
        />
      </DFormGroup>
      <DFormGroup>
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
        ></DSelect>
      </DFormGroup>
    </form>
  </DModal>

  <DModal
    :open="isDeleteModalOpen"
    title="Delete Story"
    description="All content of this story will be deleted"
    confirm-text="Delete Story"
    danger
    @confirm="deleteStory"
    @close="isDeleteModalOpen = false"
  ></DModal>
</template>
