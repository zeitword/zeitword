<script setup lang="ts">
import { computed } from "vue"

definePageMeta({ layout: "story" })

const siteId = useRouteParams("siteId")
const storyId = useRouteParams("storyId")

const { data: children, refresh: refreshChildren } = await useFetch(`/api/sites/${siteId.value}/stories/${storyId.value}/children`)
const { data: components } = await useFetch(`/api/sites/${siteId.value}/components`)
const { data: currentStory } = await useFetch(`/api/sites/${siteId.value}/stories/${storyId.value}`)

const isCreateModalOpen = ref(false)

const contentTypeOptions = computed(() => {
  return (
    components.value?.map((component) => ({
      display: component.displayName,
      value: component.id
    })) || []
  )
})

const name = ref("")
const slug = ref("")
const contentType = ref("")

const isDeleteModalOpen = ref(false)
const selectedStoryId = ref<string | null>(null)

const { toast } = useToast()

function openDeleteModal(storyId: string) {
  selectedStoryId.value = storyId
  isDeleteModalOpen.value = true
}

async function createStory() {
  if (name.value === "") return toast.info({ description: "Please enter a name" })
  if (contentType.value === "") return toast.info({ description: "Please select a content type" })

  try {
    const fullSlug = currentStory.value ? `${currentStory.value.slug}/${slug.value}` : slug.value

    await $fetch(`/api/sites/${siteId.value}/stories`, {
      method: "POST",
      body: {
        slug: fullSlug,
        title: name.value,
        content: {},
        componentId: contentType.value
      }
    })
    closeCreateModal()
    refreshChildren()
  } catch (error: any) {
    console.error(error)
    if (error.response && error.response.status === 409) {
      toast.error({ description: error.response._data.statusMessage })
    }
  }
}

function closeCreateModal() {
  name.value = ""
  slug.value = ""
  contentType.value = ""
  isCreateModalOpen.value = false
}

async function deleteStory() {
  try {
    if (!selectedStoryId.value) return
    await $fetch(`/api/sites/${siteId.value}/stories/${selectedStoryId.value}`, {
      method: "DELETE"
    })

    toast.success({ description: "Story deleted successfully" })
    refreshChildren()
  } catch (error: any) {
    console.error(error)
  } finally {
    selectedStoryId.value = null
    isDeleteModalOpen.value = false
  }
}
</script>

<template>
  <DPageTitle :title="currentStory?.title || 'Untitled Story'">
    <template #subtitle>
      <p class="text-copy-sm text-neutral-subtle">
        {{ currentStory?.slug }}
      </p>
    </template>
    <DButton @click="isCreateModalOpen = true">Add Story</DButton>
  </DPageTitle>

  <DPageWrapper>
    <div class="py-5">
      <DStoryList
        :stories="children"
        :site-id="siteId"
        :parent-slug="currentStory?.slug"
        @delete-story="openDeleteModal"
        @create-story="isCreateModalOpen = true"
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
      class="flex w-full flex-col gap-4"
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
          placeholder="e.g. Article 1"
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
          :leading="currentStory?.slug ? currentStory.slug + '/' : '/'"
          placeholder="article-1"
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
  </DModal>
</template>
