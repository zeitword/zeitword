<script setup lang="ts">
import { Ellipsis, LetterText } from "lucide-vue-next"

definePageMeta({
  layout: "site"
})

const route = useRoute()
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

async function createStory() {
  await useRequestFetch()(`/api/sites/${siteId.value}/stories`, {
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
}

function closeCreateModal() {
  name.value = ""
  slug.value = ""
  contentType.value = ""
  isCreateModalOpen.value = false
}
</script>
<template>
  <DPageTitle title="Content">
    <DButton @click="isCreateModalOpen = true">Add Story</DButton>
  </DPageTitle>
  <DPageWrapper>
    <div class="py-5">
      <DList v-if="stories && stories.length > 0">
        <DListItem
          v-for="story in stories"
          :key="story.id"
          :to="`/sites/${siteId}/content/${story.id}`"
        >
          <div class="text-copy flex w-full items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-60">
                {{ story?.title }}
              </div>
              <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
                {{ story?.component?.displayName }}
              </div>
            </div>
            <DButton
              :icon-left="Ellipsis"
              size="sm"
              variant="secondary"
            />
          </div>
        </DListItem>
      </DList>

      <div v-else>
        <DEmpty
          title="No stories yet"
          description="Create your first story to get started"
          :icon="LetterText"
          size="lg"
        >
          <DButton
            @click="isCreateModalOpen = true"
            variant="secondary"
          >
            Create Story
          </DButton>
        </DEmpty>
      </div>
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
          leading="/"
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
</template>
