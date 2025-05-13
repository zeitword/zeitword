<script setup lang="ts">
definePageMeta({
  layout: "story"
})

const route = useRoute()
const siteId = route.params.siteId as string
const storyId = route.params.storyId as string

const { data: story, refresh } = await useFetch(`/api/sites/${siteId}/stories/${storyId}`)
const { data: siteLanguages } = await useFetch(`/api/sites/${siteId}/languages`)
const { data: translatedSlugs, refresh: refreshTranslatedSlugs } = await useFetch(
  `/api/sites/${siteId}/stories/${storyId}/translated-slugs`
)

const showDeleteModal = ref(false)

const formData = ref({ title: "", slug: "" })
const translatedSlugData = ref({} as Record<string, string>)

watchEffect(() => {
  if (story.value) {
    formData.value = { title: story.value.title, slug: story.value.slug || "" }
  }

  if (translatedSlugs.value) {
    translatedSlugData.value = { ...translatedSlugs.value }
  }
})

const hasChanges = computed(() => {
  return (
    story.value?.title !== formData.value.title ||
    story.value?.slug !== formData.value.slug ||
    JSON.stringify(translatedSlugs.value) !== JSON.stringify(translatedSlugData.value)
  )
})

function resetChanges() {
  formData.value = { title: story.value?.title || "", slug: story.value?.slug || "" }
  translatedSlugData.value = { ...(translatedSlugs.value || {}) }
}

const { toast } = useToast()

const saveChanges = async () => {
  try {
    // Save main story data
    await $fetch(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "PUT",
      body: formData.value
    })

    // Save translated slugs
    await $fetch(`/api/sites/${siteId}/stories/${storyId}/translated-slugs`, {
      method: "PUT",
      body: translatedSlugData.value
    })

    toast.success({ description: "Settings saved successfully" })
    refresh() // Refresh the story data after saving
    refreshTranslatedSlugs() // Refresh translated slugs data
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
    navigateTo(`/sites/${siteId}/stories`)
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
          subtitle="The URL-friendly identifier for your story in the default language"
        >
          <DInput
            v-model="formData.slug"
            class="w-full"
          />
        </d-settings-row>

        <d-settings-row
          title="Translated Slugs"
          subtitle="Provide translated versions of your slug for each language"
        >
          <div class="space-y-3">
            <template v-if="siteLanguages && siteLanguages.length > 0">
              <template v-for="lang in siteLanguages" :key="lang.code">
                <div 
                  v-if="lang.code !== story.defaultLanguage"
                  class="flex items-center gap-3"
                >
                  <div class="w-24 font-medium">{{ lang.name }}:</div>
                  <DInput
                    v-model="translatedSlugData[lang.code]"
                    class="flex-1"
                    :placeholder="`Translated slug for ${lang.name}`"
                  />
                </div>
              </template>
            </template>
            
            <div v-if="!siteLanguages || siteLanguages.length === 0 || !siteLanguages.some(l => l.code !== story.defaultLanguage)" class="text-sm text-gray-500">
              No additional languages configured for this site
            </div>
            <div
              v-if="
                !siteLanguages ||
                siteLanguages.length === 0 ||
                !siteLanguages.some((l) => l.code !== story.defaultLanguage)
              "
              class="text-sm text-gray-500"
            >
              No additional languages configured for this site
            </div>
          </div>
        </d-settings-row>
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
