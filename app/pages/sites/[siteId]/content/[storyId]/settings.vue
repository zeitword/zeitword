<script setup lang="ts">
definePageMeta({
  layout: "story"
})

const route = useRoute()
const siteId = route.params.siteId as string
const storyId = route.params.storyId as string

const { data: story, refresh } = await useFetch(`/api/sites/${siteId}/stories/${storyId}`)

const showDeleteModal = ref(false)

const formData = ref({ title: "", slug: "" })

watchEffect(() => {
  if (story.value) {
    formData.value = { title: story.value.title, slug: story.value.slug || "" }
  }
})

const hasChanges = computed(() => {
  return story.value?.title !== formData.value.title || story.value?.slug !== formData.value.slug
})

function resetChanges() {
  formData.value = { title: story.value?.title || "", slug: story.value?.slug || "" }
}

const { toast } = useToast()

const saveChanges = async () => {
  try {
    await $fetch(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "PUT",
      body: formData.value
    })
    toast.success({ description: "Settings saved successfully" })
    refresh() // Refresh the story data after saving
  } catch (error: any) {
    toast.error({ description: "Error saving settings" })
    console.error(error)
  }
}

async function deleteStory() {
  try {
    await $fetch(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "DELETE"
    })
    // Navigate back to the site's content list (or wherever appropriate)
    navigateTo(`/sites/${siteId}/content`)
  } catch (error: any) {
    console.error(error)
  }
}
</script>

<template>
  <DPageTitle title="Story Settings" />
  <DPageWrapper>
    <div
      class="flex flex-col gap-5 py-5"
      v-if="story"
    >
      <d-settings-container>
        <d-settings-row
          title="Story Title"
          subtitle="The title of your story"
        >
          <DInput
            v-model="formData.title"
            class="w-full"
          />
        </d-settings-row>
        <d-settings-row
          title="Slug"
          subtitle="The URL-friendly identifier for your story"
        >
          <DInput
            v-model="formData.slug"
            class="w-full"
          />
        </d-settings-row>
        <!- Add more story-specific settings here, e.g., status, author, etc. -->
      </d-settings-container>

      <d-settings-container>
        <d-settings-row
          title="Delete Story"
          subtitle="This story will be permanently deleted.  This action is irreversible."
        >
          <DButton
            @click="showDeleteModal = true"
            variant="danger"
          >
            Delete
          </DButton>
        </d-settings-row>
      </d-settings-container>
    </div>

    <DModal
      :open="showDeleteModal"
      title="Delete Story"
      description="Do you want to delete this story permanently?"
      confirm-text="Delete Story"
      danger
      @confirm="deleteStory"
      @close="showDeleteModal = false"
    ></DModal>

    <d-settings-save-banner
      :show="hasChanges"
      @reset="resetChanges"
      @save="saveChanges"
      class="left-1/2 -translate-x-1/2"
    />
  </DPageWrapper>
</template>
